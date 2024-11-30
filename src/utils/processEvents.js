
// Extract a video clip
const extractClip = async (ffmpeg, inputVideoName, startTime, endTime, eventIndex) => {
  const outputName = `event_${eventIndex}.mp4`;
  try {
    await ffmpeg.exec([
      '-ss', startTime.toString(),      
      '-t', (endTime - startTime).toString(), 
      '-i', inputVideoName,             
      '-c', 'copy',
      '-loglevel', 'quiet',
      outputName                        
    ]);
    const data = await ffmpeg.readFile(outputName);
    return new Blob([data.buffer], { type: 'video/mp4' });
  } catch (error) {
    console.error(`Failed to extract clip ${eventIndex}:`, error);
    throw error;
  }
};


// Fetch description from backend
const fetchEventTitleAndDescription = async (videoBlob, eventIndex) => {

  // // DEBUG: Simulate processing
  // await new Promise(resolve => setTimeout(resolve, 5000 * Math.random()));
  // return {
  //   type: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(Math.floor(Math.random() * 26)),
  //   title: `Event ${eventIndex}`,
  //   description: 'Random Description'
  // };

  const formData = new FormData();
  formData.append('video', videoBlob, `event_${eventIndex}.mp4`);
  
  try {
    const response = await fetch('http://localhost:10708/video-to-text', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      type: data.type,
      title: data.title,
      description: data.description
    }
  } catch (error) {
    console.error(`Failed to get description for event ${eventIndex}:`, error);
    throw error;
  }
};


// Process single event and update state
const processEvent = async (event, index, ffmpeg, inputVideoName, updateEvent) => {
  try {
    // Extract clip
    const videoBlob = await extractClip(
      ffmpeg, 
      inputVideoName,
      event.startTime,
      event.endTime,
      index
    );

    // Get description and update immediately when received
    const { type, title, description } = await fetchEventTitleAndDescription(videoBlob, index);
    updateEvent(index, {
      ...event,
      type,
      title,
      description,
      clipBlob: videoBlob,
    });

  } catch (error) {
    console.error(`Failed to process event ${index}:`, error);
    updateEvent(index, {
      ...event,
      type: '⚠',
      title: 'Error',
      description: 'Failed to process event',
      error: error.message,
    });
  }
};


// Main function to process all events
export const processEvents = (events, ffmpeg, inputVideoName, updateEvent) => {
  // Start processing all events in parallel
  events.forEach((event, index) => {
    // Mark event as processing
    updateEvent(index, {
      ...event,
      description: 'Processing...'
    });

    // Process each event asynchronously
    processEvent(event, index, ffmpeg, inputVideoName, updateEvent);
  });
};