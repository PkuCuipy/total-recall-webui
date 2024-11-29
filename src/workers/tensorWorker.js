/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// import * as tf from '@tensorflow/tfjs'; // fixme: only for syntax highlighting, remove before compile


const tensorWorkerCode = () => {
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js');

  onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'CONVERT_FRAMES') {
      const { framesU1Array, mergeEvery, height, width, amp, power, smooth } = data;

      const nrFramesFull = framesU1Array.length / (height * width);
      const nFrames = Math.floor(nrFramesFull / mergeEvery);

      //// Pipeline:
      //// U1Array -> tf.Tensor -> MergedFrames -> Diffs -> Opacity Masks -> Energies

      // U1Array -> tf.Tensor -> MergedFrames
      const frames = tf.tidy(() => {
        const framesTensor = tf.tensor3d(
          Float32Array.from(framesU1Array),
          [nrFramesFull, height, width]
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
        const raw = masks.sum([1, 2]);
        console.log(raw);
        const smoothKernel = tf.tensor3d(new Array(smooth).fill(1), [smooth, 1, 1]).div(smooth);
        console.log('smoothKernel', smoothKernel);
        const smoothen = raw.expandDims(1).conv1d(smoothKernel, 1, 'same').squeeze();
        const max = tf.max(smoothen);
        return smoothen.div(max);
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
      console.log('Tensors ready', framesData, masksData, energiesData);
      postMessage({
        type: 'TENSORS_READY',
        frames: framesData,
        masks: masksData,
        energies: energiesData,
      });
    }

  };
};

const workerBlob = new Blob([`(${tensorWorkerCode.toString()})()`], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

export default workerUrl;