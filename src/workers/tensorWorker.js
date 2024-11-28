/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

// import * as tf from '@tensorflow/tfjs'; // fixme: only for syntax highlighting, remove before compile


const tensorWorkerCode = () => {
  importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js');

  onmessage = async (e) => {
    const { type, data } = e.data;

    if (type === 'CONVERT_FRAMES') {
      const { framesU1Array, mergeEvery, height, width, amp, power } = data;

      const nrFramesFull = framesU1Array.length / (height * width);
      const nFrames = Math.floor(nrFramesFull / mergeEvery);

      //// Pipeline:
      //// U1Array -> tf.Tensor -> MergedFrames -> Diffs -> Opacity Masks

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
        const diffs = tf.sub(frames, shiftRight)
                        .abs()
                        .pow(power);
        const maxDiff = tf.max(diffs);
        return diffs.div(maxDiff).mul(amp).clipByValue(0, 1);
      });

      // Cast to typed arrays for data transfer
      const [framesData, masksData] = await Promise.all([
        frames.data(),
        masks.data(),
      ]);

      // Free up memory manually
      frames.dispose();
      masks.dispose();

      // Transfer data back to main thread
      console.log('Tensors ready', framesData, masksData);
      postMessage({
        type: 'TENSORS_READY',
        frames: framesData,
        masks: masksData,
      });
    }

  };
};

const tensorWorkerBlob = new Blob([`(${tensorWorkerCode.toString()})()`], { type: 'application/javascript' });
const tensorWorkerUrl = URL.createObjectURL(tensorWorkerBlob);

export default tensorWorkerUrl;