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

    const { energies, totalSeconds, minSeconds, paddingSeconds, maxGap, maxNumEvents, minEnergy } = e.data;
    const nFrames = energies.length;
    const frameToSec = (frameIdx) => frameIdx / nFrames * totalSeconds;

    // Find connected domains where energy >= minEnergy
    const domains = [];
    let currentDomain = null;
    for (let i = 0; i < nFrames; i++) {
      if (energies[i] >= minEnergy) {
        if (!currentDomain) {   // Start new domain
          currentDomain = {
            startFrame: i,
            endFrame: i,
            energySum: energies[i],
          };
        } else {
          currentDomain.endFrame = i;
          currentDomain.energySum += energies[i];
        }
      } else if (currentDomain) { // End current domain
        domains.push(currentDomain);
        currentDomain = null;
      }
    }

    if (currentDomain) {  // for the last domain if it's not ended
      domains.push(currentDomain);
    }

    // Convert frames to seconds and add padding
    let events = domains.map(domain => ({
      startTime: Math.max(0, frameToSec(domain.startFrame) - paddingSeconds),
      endTime: Math.min(totalSeconds, frameToSec(domain.endFrame) + paddingSeconds),
      avgEnergy: domain.energySum / (domain.endFrame - domain.startFrame + 1),
    }));

    // Merge overlapping events
    events.sort((a, b) => a.startTime - b.startTime);
    const mergedEvents = [];
    for (const event of events) {
      const lastEvent = mergedEvents[mergedEvents.length - 1];
      if (lastEvent && event.startTime - maxGap <= lastEvent.endTime) {
        // Merge events
        lastEvent.endTime = Math.max(lastEvent.endTime, event.endTime);
        lastEvent.avgEnergy = Math.max(lastEvent.avgEnergy, event.avgEnergy);
      } else {
        mergedEvents.push(event);
      }
    }

    // Filter out events shorter than minimum length
    events = mergedEvents.filter(event =>
      event.endTime - event.startTime >= minSeconds
    );

    // Sort by score (avgEnergy * duration) and keep top events
    events.sort((a, b) => {
      const scoreA = a.avgEnergy * (a.endTime - a.startTime);
      const scoreB = b.avgEnergy * (b.endTime - b.startTime);
      return scoreB - scoreA;
    });
    events = events.slice(0, maxNumEvents);

    // Sort by start time for final output
    events.sort((a, b) => a.startTime - b.startTime);

    // Remove energy properties before sending
    events = events.map(({ startTime, endTime }) => ({ startTime, endTime }));

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