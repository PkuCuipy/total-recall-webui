/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

const tensorWorkerCode = () => {
  onmessage = async (e) => {
    console.warn('TensorWorker is called', Date.now());
    const { type, data } = e.data;

    if (type === 'CONVERT_FRAMES') {
      const { framesU1Array, height, width, amp, power, smooth} = data;

      const nFrames = framesU1Array.length / (height * width * 3);

      /*
       *  Pipeline:
       *  framesU1Array -> Diffs -> opacityMasks -> Energies
      */

      // framesU1Array --> Diffs
      let diffs = new Float32Array(nFrames * height * width);
      for (let f = 0; f < nFrames; f++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let diffSum = 0;
            for (let c = 0; c < 3; c++) {
              const idxThis = f * (height * width * 3) + y * (width * 3) + x * 3 + c;
              const idxPrev = Math.max(0, f - 1) * (height * width * 3) + y * (width * 3) + x * 3 + c;
              diffSum += Math.abs(framesU1Array[idxThis] - framesU1Array[idxPrev]);
            }
            const saveIdx = f * (height * width) + y * width + x;
            diffs[saveIdx] = diffSum / 3;
          }
        }
      }

      // Diffs --> opacityMasks
      let maxDiff = 0;
      for (let i = 0; i < diffs.length; i++) {
        maxDiff = Math.max(maxDiff, diffs[i]);
      }
      for (let i = 0; i < diffs.length; i++) {
        diffs[i] = Math.min(1, Math.max(0, Math.pow(diffs[i] / maxDiff, power) * amp));
      }

      // opacityMasks --> Energies
      const rawEnergies = new Float32Array(nFrames);
      for (let f = 0; f < nFrames; f++) {
        let sum = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = f * (height * width) + y * width + x;
            sum += diffs[idx];
          }
        }
        rawEnergies[f] = sum;
      }

      // Energies --> thresholdedEnergies (with Quantile 0.99 as threshold)
      const sorted = rawEnergies.slice();
      sorted.sort((a, b) => a - b);
      const quantile = sorted[Math.floor(sorted.length * 0.99)];
      for (let i = 0; i < nFrames; i++) {
        rawEnergies[i] = Math.min(quantile, rawEnergies[i]);
      }

      // thresholdedEnergies --> smoothenEnergies (Gaussian smoothing)
      let energies = new Float32Array(nFrames);
      const sigma = smooth;
      const kernelSize = Math.ceil(4 * sigma);
      const center = Math.round(kernelSize / 2);
      const smoothKernelArray = Array.from({ length: kernelSize }, (_, i) => Math.exp(-(i - center) * (i - center) / (2 * sigma * sigma)));
      for (let f = 0; f < nFrames; f++) {
        let sum = 0;
        for (let i = 0; i < kernelSize; i++) {
          const idx = (f + i - center + nFrames) % nFrames;
          sum += rawEnergies[idx] * smoothKernelArray[i];
        }
        energies[f] = sum;
      }

      // Normalize energies[] array to R[0, 1]
      let maxEnergy = 0;
      let minEnergy = 1;
      for (let i = 0; i < nFrames; i++) {
        maxEnergy = Math.max(maxEnergy, energies[i]);
        minEnergy = Math.min(minEnergy, energies[i]);
      }
      let range = maxEnergy - minEnergy;
      for (let i = 0; i < nFrames; i++) {
        energies[i] = (energies[i] - minEnergy) / range;
      }

      // Transfer data back to the main thread
      console.log('Tensors ready', diffs, energies, Date.now());
      postMessage({
        type: 'TENSORS_READY',
        frames: framesU1Array,
        masks: diffs,
        energies: energies,
      });
    }

  };
};

const workerBlob = new Blob([`(${tensorWorkerCode.toString()})()`], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(workerBlob);

export default workerUrl;