
// Extract a video frame
const extractFrameAsURL = async (ffmpeg, inputVideoName, timeInSeconds, targetHeight, targetWidth, eventIndex) => {
  const outputName = `event_${eventIndex}_thumbnail.png`;
  try {
    await ffmpeg.exec([
      '-ss', timeInSeconds.toString(),
      '-i', inputVideoName,
      '-vf', `scale=${targetWidth}:${targetHeight}`,
      '-vframes', '1',
      '-loglevel', 'quiet',
      outputName
    ]);
    const data = await ffmpeg.readFile(outputName);
    return URL.createObjectURL(new Blob([data.buffer], { type: 'image/png' }));
  } catch (error) {
    console.error('Failed to extract frame:', error);
    throw error;
  }
}


// Extract a video clip
const extractVideoClipBlob = async (ffmpeg, inputVideoName, startTime, endTime, eventIndex) => {
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
const fetchEventDetails = async (videoBlob, eventIndex) => {

  console.warn(`Fetching description for event ${eventIndex}...`);

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
      description: data.description,
      objects: data.objects,
    }
  } catch (error) {
    console.error(`Failed to get description for event ${eventIndex}:`, error);
    throw error;
  }
};


// Process single event and update state
const processEvent = async (event, eventID, ffmpeg, inputVideoName, updateEvent) => {
  try {
    const videoBlob = await extractVideoClipBlob(
      ffmpeg,
      inputVideoName,
      event.startTime,
      event.endTime,
      eventID
    );

    // Extract thumbnail
    const midTime = (event.startTime + event.endTime) / 2;    // fixme: This can be changed to energy peak time
    const thumbnailURL = await extractFrameAsURL(ffmpeg, inputVideoName, midTime, 180, 320, eventID);
    const eventWithThumbnail = {
      ...event,
      thumbnailURL,
    };
    updateEvent(eventID, eventWithThumbnail);

    // Fetch event details from backend API
    const { type, title, description, objects } = await fetchEventDetails(videoBlob, eventID);
    const eventWithThumbnailAndDetails = {
      ...eventWithThumbnail,
      type,
      title,
      description,
      objects
    }
    updateEvent(eventID, eventWithThumbnailAndDetails);

  } catch (error) {
    console.error(`Failed to process event ${eventID}:`, error);
    updateEvent(eventID, {
      ...event,
      type: '⚠',
      title: '(Error) ' + event.title,
      description: 'Failed to generate description for this event',
      error: error.message,
    });
  }
};


// Process all events
export const processEvents = (events, ffmpeg, inputVideoName, updateEvent) => {
  events.forEach((event, index) => {
    // Mark event as processing
    updateEvent(index, {
      ...event,
      title: 'Generating Title...',
      description: 'Generating Description...',
    });
    // Process each event asynchronously
    processEvent(event, index, ffmpeg, inputVideoName, updateEvent);
  });
};