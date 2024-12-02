/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

const plottingWorkerCode = () => {
  onmessage = async (e) => {

    const { type, data } = e.data;
    console.warn('PlottingWorker is called with params:', type, data);

    if (type === 'MAKE_3D_VIEW') {
      const {frames, masks, height, width} = data;
      const nFrames = frames.length / (height * width * 3);
      const canvasW = nFrames + width - 1;
      const canvasF32 = new Float32Array(height * canvasW * 3);
      for (let i = 0; i < nFrames; i++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) {
              // frames[i][y][x][c])
              // masks[i][y][x]
              // canvasF32[y][x + i][c]
              const frameIdx = (i)*(height * width * 3) + (y)*(width * 3) + x*(3) + c;
              const canvasIdx = (y) * (canvasW * 3) + (x + i) * (3) + c;
              const maskIdx = (i)*(height * width) + (y)*(width) + x;
              const frameVal = frames[frameIdx];
              const maskVal = masks[maskIdx];
              const canvasVal = canvasF32[canvasIdx];
              canvasF32[canvasIdx] = (1 - maskVal) * canvasVal + maskVal * frameVal;
            }
          }
        }
      }
      const canvasU1 = Uint8Array.from(canvasF32.map((val) => Math.floor(val))); // to uint8 0-255
      // console.log('View3D Graph ready', canvasU1);
      postMessage({
        type: '3D_VIEW_GRAPH_READY',
        data: {
          graph: canvasU1,
          graphHeight: height,
          graphWidth: canvasW,
        }
      });
    }

    else if (type === 'MAKE_ENERGY_GRAPH') {
      const {energies, height, width} = data;
      const nFrames = energies.length;
      const canvasW = nFrames + width - 1;
      const canvasU1 = new Uint8Array(height * canvasW);
      const leftPadding = Math.floor(width / 2);
      for (let i = 0; i < nFrames; i++) {
        const h = Math.floor(energies[i] * height) * 0.9; // 0.9 for prettier visualization
        for (let y = height; y >= height - h; y--) {
          // canvasU1[y][i + leftPadding]
          const canvasIdx = y * canvasW + i + leftPadding;
          canvasU1[canvasIdx] = 180;
        }
      }
      // console.log('Energy Graph ready', canvasU1);
      postMessage({
        type: 'ENERGY_GRAPH_READY',
        data: {
          graph: canvasU1,
          graphHeight: height,
          graphWidth: canvasW,
        }
      });
    }

    else if (type === 'MAKE_THUMBNAILS_GRAPH') {
      // console.warn('Making Thumbnails Graph...');
      const {frames, height, width, aspectRatio} = data;
      const nFrames = frames.length / (height * width * 3);
      const nThumbnails = Math.floor(nFrames / width) + 1;
      const canvasW = nFrames + width - 1;
      const canvasU1 = new Uint8Array(height * canvasW * 3);

      for (let thumbnailIdx = 0; thumbnailIdx < nThumbnails; thumbnailIdx++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            for (let c = 0; c < 3; c++) {
              // canvasU1[y][x + thumbnailIdx * width][c]    shape=[height, canvasW, 3]
              // frames[thumbnailIdx * width][y][x][3]       shape=[nFrames, height, width, 3]
              const canvasIdx = y * (canvasW * 3) + (x + thumbnailIdx * width) * 3 + c;
              const frameIdx = thumbnailIdx * width * (height * width * 3) + y * (width * 3) + x * 3 + c;
              canvasU1[canvasIdx] = frames[frameIdx];
            }
          }
        }
      }
      // console.log('Thumbnails Graph ready', canvasU1);
      postMessage({
        type: 'THUMBNAILS_GRAPH_READY',
        data: {
          graph: canvasU1,
          graphHeight: height,
          graphWidth: canvasW,
        }
      });
    }

    else {
      console.error('Unknown type', type);
    }

  }
};

const workerBlob = new Blob([`(${plottingWorkerCode.toString()})()`], { type: "application/javascript" });
const workerURL = URL.createObjectURL(workerBlob);

export default workerURL;
