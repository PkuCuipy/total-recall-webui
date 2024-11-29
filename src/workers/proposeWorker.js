/* eslint-disable no-restricted-globals */
/* eslint-disable no-undef */

const proposeWorkerCode = () => {
  onmessage = async (e) => {
    /*
    * Input:
    *   Energies: size=[nFrames, ], type=Float32, range=[0, 1]
    * Output:
    *   List[Events]: size=[nEvents, ], type=Event,
    *   where Event: {
    *     startTime: Float32,
    *     endTime: Float32,
    *   }
    * */

    const { energies, totalSeconds, maxGap, maxSeconds, paddingSeconds, maxNumEvents, minEnergy } = e.data;
    const nFrames = energies.length;
    const frameToSec = (frameIdx) => frameIdx / nFrames * totalSeconds;

    // Find Local Maxima
    const localMaxima = [];
    for (let i = 1; i < nFrames - 1; i++) {
      if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > minEnergy) {
        localMaxima.push({second: frameToSec(i), energy: energies[i]});
      }
    }

    // Gather Events
    const sentinelEvent = {
      startTime: -maxGap - 2,
      endTime: -maxGap - 1,
      energy: 0,
    };
    let events = [sentinelEvent];
    for (const { second, energy } of localMaxima) {
      const lastEvent = events[events.length - 1];
      if (second - lastEvent.endTime <= maxGap && second - lastEvent.startTime <= maxSeconds) {
        lastEvent.endTime = second;
        lastEvent.energy = Math.max(lastEvent.energy, second);
      } else {
        events.push({
          startTime: second,
          endTime: second,
          energy: energy,
        });
      }
    }
    events = events.slice(1);   // Remove sentinel

    // Add Padding and Clip to [0, totalSeconds]
    for (const event of events) {
      event.startTime = Math.max(0, event.startTime - paddingSeconds);
      event.endTime = Math.min(totalSeconds, event.endTime + paddingSeconds);
    }

    // Fix overlapping events
    for (let i = 1; i < events.length; i++) {
      if (events[i].startTime < events[i - 1].endTime) {
        events[i - 1].endTime = events[i].startTime;
      }
    }
    console.log("Events before filtering", events);

    // Remove very short events
    const lengthEps = 1;
    events = events.filter((event) => event.endTime - event.startTime > lengthEps);

    // Only keep top energy events
    events.sort((a, b) => b.energy - a.energy);
    events = events.slice(0, maxNumEvents);

    // Sort by start time
    events.sort((a, b) => a.startTime - b.startTime);
    console.log('Events ready', events);
    postMessage({
      type: 'PROPOSED_EVENTS_READY',
      data: {
        events: events,
      },
    });
  }
};

const workerBlob = new Blob([`(${proposeWorkerCode.toString()})()`], { type: "application/javascript" });
const workerURL = URL.createObjectURL(workerBlob);

export default workerURL;
