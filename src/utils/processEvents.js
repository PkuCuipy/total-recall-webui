
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
const extractVideoClipAsBlob = async (ffmpeg, inputVideoName, startTime, endTime, eventIndex) => {
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
    const tags = data.objects ?? data.tags ?? [];  // backward compatibility
    const type = data.emoji ?? data.type;          // backward compatibility
    return {
      type: type,
      title: data.title,
      description: data.description,
      tags: tags.length !== 0 ? tags : ['No tags'],
    }
  } catch (error) {
    console.error(`Failed to get description for event ${eventIndex}:`, error);
    throw error;
  }
};


// Process single event and update state
const processEvent = async (event, eventID, ffmpeg, inputVideoName, updateEvent) => {
  try {
    const videoBlob = await extractVideoClipAsBlob(
      ffmpeg,
      inputVideoName,
      event.startTime,
      event.endTime,
      eventID
    );

    // Extract thumbnail
    const midTime = (event.startTime + event.endTime) / 2;    // fixme: This can be changed to energy peak time
    const thumbnailURL = await extractFrameAsURL(ffmpeg, inputVideoName, midTime, 180, 320, eventID);
    event = {
      ...event,
      thumbnailURL,
    };
    updateEvent(eventID, event);

    // Fetch event details from backend API
    const { type, title, description, tags } = await fetchEventDetails(videoBlob, eventID);
    event = {
      ...event,
      type,
      title,
      description,
      tags,
    }
    updateEvent(eventID, event);

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