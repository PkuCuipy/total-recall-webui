/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// import * as tf from '@tensorflow/tfjs'; // fixme: only for syntax highlighting, remove before compile


const tensorWorkerCode = () => {
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js');

  onmessage = async (e) => {
    console.warn('TensorWorker is called');
    const { type, data } = e.data;

    if (type === 'CONVERT_FRAMES') {
      const { framesU1Array, mergeEvery, height, width, amp, power, smooth } = data;

      const nFramesOri = framesU1Array.length / (height * width);
      const nFrames = Math.floor(nFramesOri / mergeEvery);

      /*
       *  Pipeline:
       *  U1Array -> tf.Tensor -> MergedFrames -> Diffs -> Opacity Masks -> Energies
      */

      // U1Array -> tf.Tensor -> MergedFrames
      const frames = tf.tidy(() => {
        const framesTensor = tf.tensor3d(
          Float32Array.from(framesU1Array),
          [nFramesOri, height, width]
        );
        return framesTensor
          .slice([0, 0, 0], [nFrames * mergeEvery, height, width])  // --> [nFrames * mergeEvery, height, width]
          .reshape([nFrames, mergeEvery, height, width])            // --> [nFrames, mergeEvery, height, width]
          .mean(1);                                                 // --> [nFrames, height, width]
      });

      // MergedFrames -> Diffs -> Opacity Masks
      const masks = tf.tidy(() => {
        const len = frames.shape[0];
        const shiftRight = tf.concat([
            frames.slice([0, 0, 0], [1,     -1, -1]),
            frames.slice([0, 0, 0], [len-1, -1, -1])
          ], 0
        );
        const diffs = tf.sub(frames, shiftRight).abs().pow(power);
        const maxDiff = tf.max(diffs);
        return diffs.div(maxDiff).mul(amp).clipByValue(0, 1);
      });

      // Masks -> Energies
      const energies = tf.tidy(() => {
        const rawEnergies = masks.sum([1, 2]);    // -> [nFrames, ]

        // Quantile 0.99 as threshold
        const rawE = rawEnergies.slice([0], [nFrames]);
        const sorted = rawE.dataSync().sort((a, b) => a - b);
        const quantile = sorted[Math.floor(sorted.length * 0.99)];
        const threshold = tf.scalar(quantile);

        // Thresholding
        const thresholded = rawEnergies.clipByValue(0, threshold.dataSync()[0]);

        // Gaussian smoothing
        const sigma = smooth;
        const kernelSize = Math.ceil(4 * sigma);
        const center = Math.round(kernelSize / 2);
        const smoothKernelArray = Array.from({ length: kernelSize }, (_, i) => Math.exp(-(i - center) * (i - center) / (2 * sigma * sigma)));
        const smoothKernel = tf.tensor3d(smoothKernelArray, [kernelSize, 1, 1]);
        const smoothen = thresholded.expandDims(1).conv1d(smoothKernel, 1, 'same').squeeze();

        // Normalize to [0, 1]
        const max = tf.max(smoothen);
        const min = tf.min(smoothen);
        const range = max.sub(min);
        return smoothen.sub(min).div(range);    // -> [0, 1]
      });

      // Cast to typed arrays for data transfer
      const [framesData, masksData, energiesData] = await Promise.all([
        frames.data(),
        masks.data(),
        energies.data(),
      ]);

      // Free up memory manually
      frames.dispose();
      masks.dispose();
      energies.dispose();

      // Transfer data back to main thread
      // console.log('Tensors ready', framesData, masksData, energiesData);
      postMessage({
        type: 'TENSORS_READY',
        frames: framesData,
        masks: masksData,
        energies: energiesData,
        numMergedFrames: nFrames,
      });
    }

  };
};

const workerBlob = new Blob([`(${tensorWorkerCode.toString()})()`], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

export default workerUrl;