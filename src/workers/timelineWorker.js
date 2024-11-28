/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

const timelineWorkerCode = () => {
  onmessage = async (e) => {
    const { type, data } = e.data;
    const { frames, masks, height, width } = data;

    if (type === 'MAKE_TIMELINE') {
      const nFrames = frames.length / (height * width);
      const canvasW = nFrames + width - 1;
      const timelineCanvas = new Float32Array(height * canvasW);

      for (let i = 0; i < nFrames; i++) {
        const frameOffset = i * height * width;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const frameIdx = frameOffset + y * width + x;
            const canvasIdx = y * canvasW + x + i;

            const frameVal = frames[frameIdx];
            const maskVal = masks[frameIdx];
            const canvasVal = timelineCanvas[canvasIdx];

            timelineCanvas[canvasIdx] = (1 - maskVal) * canvasVal + maskVal * frameVal;
          }
        }
      }

      const timelineCanvasU1 = Uint8Array.from(timelineCanvas.map((val) => Math.floor(val)));

      console.log('Timeline ready', timelineCanvasU1);
      postMessage({
        type: 'TIMELINE_READY',
        data: {
          timeline: timelineCanvasU1,
          height: height,
          width: canvasW,
        }
      });
    }
  }
};

const timelineWorkerBlob = new Blob([`(${timelineWorkerCode.toString()})()`], { type: "application/javascript" });
const timelineWorkerURL = URL.createObjectURL(timelineWorkerBlob);

export default timelineWorkerURL;
