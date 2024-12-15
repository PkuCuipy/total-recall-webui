import { Buffer } from "buffer";
import OpenAI from "openai";



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
    // return URL.createObjectURL(new Blob([data.buffer], { type: 'image/png' }));
    return `data:image/png;base64,${Buffer.from(data.buffer).toString('base64')}`;
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
      return { success: false, error: `HTTP error! status: ${response.status}` };
    }
    
    const data = await response.json();
    const tags = data.objects ?? data.tags ?? [];  // backward compatibility
    const type = data.emoji ?? data.type;          // backward compatibility
    return {
      success: true,
      type: type,
      title: data.title,
      description: data.description,
      tags: tags.length !== 0 ? tags : ['No tags'],
    }
  } catch (error) {
    console.log(`Failed to get description for event ${eventIndex}:`, error);
    return { success: false };
  }
};


const fetchEventDetailsOpenAI = async (imageURL, eventIndex) => {

  // Read OpenAI API key from local storage
  const openaiAPIKey = localStorage.getItem('openai-api-key');
  if (openaiAPIKey === null) {
    return {
      success: false,
      error: 'OpenAI API key not found',
    };
  }

  // Initialize OpenAI API
  const openai = new OpenAI({
    apiKey: openaiAPIKey,
    dangerouslyAllowBrowser: true,
  });

  // Fetch event details from OpenAI Vision Model
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Describe this image for an event analysis app. Format in JSON, all concise, description should better within 15 words. tags are for event filtering. e.g., ' +
                    '{\n' +
                    '    "title": "Fire in city",\n' +
                    '    "emoji": "🔥",\n' +
                    '    "description": "A large explosion in a parking lot while a car is driving by.",\n' +
                    '    "tags": ["car", "parking", "explosion"]\n' +
                    '}\n'
            },
            {
              type: "image_url",
              image_url: {
                "url": imageURL,
              },
            },
          ],
        },
      ],
    });
    console.log(response.choices[0]);

    // Parse OpenAI response
    const rawStr = response.choices[0].message.content;
    const jsonPattern = /{[^]*}/;
    const jsonStr = jsonPattern.exec(rawStr);
    const parsedJSON = JSON.parse(jsonStr);
    console.log(parsedJSON);

    return {
      success: true,
      type: parsedJSON.emoji || '🔍',
      title: parsedJSON.title || 'Unknown',
      description: parsedJSON.description || 'Unknown',
      tags: parsedJSON.tags || ['No tags'],
    };
  }
  catch (e) {
    console.error('Failed to fetch event details from OpenAI:', e);
    return {
      success: false,
      error: 'Failed to fetch event details from OpenAI' + e,
    };
  }
}


// Process single event and update state
const analyzeOneEvent = async (event, ffmpeg, inputVideoName, updateEvent) => {

  const videoBlob = await extractVideoClipAsBlob(
    ffmpeg,
    inputVideoName,
    event.startTime,
    event.endTime,
    event.eventID
  );

  // Extract thumbnail
  const midTime = (event.startTime + event.endTime) / 2;    // fixme: This can be changed to energy peak time
  const thumbnailURL = await extractFrameAsURL(ffmpeg, inputVideoName, midTime, 288, 512, event.eventID);
  event = {
    ...event,
    thumbnailURL,
  };
  updateEvent(event.eventID, event);

  // Fetch event details from backend API
  // 1. First try local API
  {
    const { success, type, title, description, tags } = await fetchEventDetails(videoBlob, event.eventID);
    if (success) {
      event = {
        ...event,
        type,
        title,
        description,
        tags,
      }
      updateEvent(event.eventID, event);
      return;
    }
  }

  // 2. If failed, try OpenAI API
  {
    const { success, type, title, description, tags } = await fetchEventDetailsOpenAI(thumbnailURL, event.eventID);
    if (success) {
      event = {
        ...event,
        type,
        title,
        description,
        tags,
      }
      updateEvent(event.eventID, event);
      return;
    }
  }

  // 3. If still failed, display error message
  event = {
    ...event,
    type: '⚠',
    title: 'Failed to process',
    description: "Failed to analyze, try enter your OpenAI API key and click '🔍Re-Analyze'",
    tags: ['Failed to process'],
  };
  updateEvent(event.eventID, event);
};


// Process all events
export const analyzeAllEvents = (events, ffmpeg, inputVideoName, updateEvent) => {
  events.forEach((event) => {
    // Mark event as processing
    const newEvent = {
      ...event,
      type: '⋯',
      title: 'Processing...',
      description: 'Processing...',
      tags: ['Processing...'],
    };
    updateEvent(event.eventID, newEvent);
    // Process each event asynchronously
    analyzeOneEvent(newEvent, ffmpeg, inputVideoName, updateEvent);
  });
};