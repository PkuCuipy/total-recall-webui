const timelineWorkerCode = () => {
  onmessage = function (e) {
    console.log(`[Timeline]: Received ${e.data}`);

    const [a, b] = e.data;
    let workerResult = 0;
    for (let i = 0; i < b; i++) {
      workerResult += a;
    }

    postMessage(workerResult);
    console.log(`[Timeline]: Returned ${workerResult}`);
  };
};

const timelineWorkerBlob = new Blob([`(${timelineWorkerCode.toString()})()`], {type: "application/javascript"});
const timelineWorkerURL = URL.createObjectURL(timelineWorkerBlob);

export default timelineWorkerURL;
