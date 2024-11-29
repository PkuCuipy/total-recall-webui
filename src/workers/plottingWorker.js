/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

const plottingWorkerCode = () => {
  onmessage = async (e) => {

    const { type, data } = e.data;
    const { frames, masks, energies, height, width } = data;

    if (type === 'MAKE_3D_VIEW') {
      const nFrames = frames.length / (height * width);
      const canvasW = nFrames + width - 1;
      const canvasF32 = new Float32Array(height * canvasW);
      for (let i = 0; i < nFrames; i++) {
        const frameOffset = i * height * width;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const frameIdx = frameOffset + y * width + x;
            const canvasIdx = y * canvasW + x + i;
            const frameVal = frames[frameIdx];
            const maskVal = masks[frameIdx];
            const canvasVal = canvasF32[canvasIdx];
            canvasF32[canvasIdx] = (1 - maskVal) * canvasVal + maskVal * frameVal;
          }
        }
      }
      const canvasU1 = Uint8Array.from(canvasF32.map((val) => Math.floor(val))); // to uint8 0-255
      console.log('View3D Graph ready', canvasU1);
      postMessage({
        type: '3D_VIEW_GRAPH_READY',
        data: {
          graph: canvasU1,
          height: height,
          width: canvasW,
        }
      });
    }

    else if (type === 'MAKE_ENERGY_GRAPH') {
      const nFrames = energies.length;
      const canvasW = nFrames + width - 1;
      const canvasU1 = new Uint8Array(height * canvasW);
      const leftPadding = Math.floor(width / 2);
      for (let i = 0; i < nFrames; i++) {
        const energy = energies[i];
        const h = Math.floor(energy * height);
        const canvasX = i + leftPadding;
        for (let y = height; y >= height - h; y--) {
          const canvasIdx = y * canvasW + canvasX;
          canvasU1[canvasIdx] = 180;
        }
      }
      console.log('Energy Graph ready', canvasU1);
      postMessage({
        type: 'ENERGY_GRAPH_READY',
        data: {
          graph: canvasU1,
          height: height,
          width: canvasW,
        }
      });
    }

    else if (type === 'MAKE_THUMBNAILS_GRAPH') {

    }

    else {
      console.error('Unknown type', type);
    }

  }
};

const workerBlob = new Blob([`(${plottingWorkerCode.toString()})()`], { type: "application/javascript" });
const workerURL = URL.createObjectURL(workerBlob);

export default workerURL;
