import React, { useRef, useState, useEffect } from 'react';


const formatSeconds = (seconds) => {
  /* Format like: `09:03:12` or `03:12` if hours is 0 */
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = Math.floor(seconds) % 60;
  if (h === 0)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const EventBlock = ({ event, seekTo }) => {
  //   *------------------------------------*
  //   |          | Title       |           |
  //   | TypeIcon | Description | Thumbnail |
  //   |          | StartTime   |           |
  //   *------------------------------------*
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex w-full my-1.5 items-center justify-between rounded-xl bg-gray-900 select-none cursor-pointer hover:opacity-90"
         onClick={() => seekTo(event.startTime)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
    >
      {/* Left Icon*/}
      <div className="w-[50px] h-[50px] mx-4 my-4 bg-gray-500 rounded-full flex items-center justify-center">
        {event.type}
      </div>

      {/* Middle Text*/}
      <div className="mr-1">
        <p className="text-md font-bold max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis">{event.title}</p>
        <p className="text-sm max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis">{event.description}</p>
        <p className="text-sm">{formatSeconds(event.startTime)}</p>
      </div>

      {/* Space */}
      <div className="flex-1"/>

      {/* Right Thumbnail*/}
      <div className="w-[100px] h-[70px] m-2 bg-gray-500 flex items-center justify-center rounded-lg relative cursor-pointer overflow-hidden">
        <img className="absolute w-full h-full object-fit"
             src={`https://picsum.photos/200/300`}
              alt="Thumbnail"
        />
        {hovered && (
          <div className="absolute bg-neutral-900 text-neutral-100 bg-opacity-80 text-2xl py-0.5 px-3 rounded-lg">
            ▶
          </div>
        )}
      </div>
    </div>
  );
}


const fakeEvents = [
  {
    title: 'Cat Appears',
    description: 'Description',
    startTime: 123.12,
    type: 'Type',
  },
  {
    title: 'Dog Appears',
    description: 'Description',
    startTime: 178.34,
    type: 'Type',
  },
  {
    title: 'Someone Moves This line very long',
    description: 'Description',
    startTime: 234.56,
    type: 'Type',
  },
  {
    title: 'Light Changes',
    description: 'Description',
    startTime: 345.67,
    type: 'Type',
  },
  {
    title: 'Pet Appears',
    description: 'Description',
    startTime: 456.78,
    type: 'Type',
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: 'Type',
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: 'Type',
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: 'Type',
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: 'Type',
  },
]

const EventsList = ({ events, seekTo }) => {
  // events = fakeEvents;   // debug only
  return (
    <div
      className="min-w-[25rem] p-4 flex flex-col bg-gray-800 text-neutral-300 rounded-xl border-2 border-gray-500 overflow-scroll">
      {
        (events.length === 0) ?
          <div className="m-auto">
            Upload a video to start ➡
          </div>
          :
          events.map((event, idx) => (
            <EventBlock
              key={idx}
              event={event}
              seekTo={seekTo}
            />
          ))
      }
    </div>
  );
}

export default EventsList;