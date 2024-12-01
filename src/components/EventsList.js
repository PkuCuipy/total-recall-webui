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

const textToColor = (text) => {
  /* Generate a color from the hash of the text */
  const colors = ["bg-red-200", "bg-orange-200", "bg-yellow-200", "bg-lime-200", "bg-green-200", "bg-teal-200", "bg-blue-200", "bg-indigo-200", "bg-purple-200", "bg-pink-200"];
  const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}


const EventBlock = ({ event, seekTo }) => {
  //   *------------------------------------*
  //   |          | Title       |           |
  //   | TypeIcon | Description | Thumbnail |
  //   |          | StartTime   |           |
  //   *------------------------------------*
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex w-full my-1.5 items-center justify-between rounded-xl bg-gray-900 select-none cursor-pointer hover:opacity-90"
      onClick={() => seekTo(event.startTime)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {(hovered === false)
        ?
        <>
          {/* Left Icon*/}
          <div className={`${textToColor(event.type)} w-[50px] h-[50px] mx-4 my-4 bg-gray-500 rounded-full flex items-center justify-center text-2xl`}>
            {event.type}
          </div>
          {/* Middle Text*/}
          <div className="mr-1">
            <p className="text-md font-bold max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis">{event.title}</p>
            {/*<p className="text-sm max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis">{event.description}</p>*/}
            <p className="text-sm">{formatSeconds(event.startTime)}</p>
          </div>
          {/* Space */}
          <div className="flex-1"/>
          {/* Right Thumbnail*/}
          <div className="w-[100px] h-[70px] m-2 bg-gray-500 flex items-center justify-center rounded-lg relative cursor-pointer overflow-hidden">
            <img className="absolute w-full h-full object-fit" src={`https://picsum.photos/200/300`} alt="Thumbnail"/>
          </div>
        </>
        :
        <>
          {/* Space */}
          <div className="flex-1"/>
          {/* Text*/}
          <div className="ml-4">
            <p className="text-sm max-w-[230px] max-h-[60px] overflow-auto">{event.description}</p>
          </div>
          {/* Space */}
          <div className="flex-1"/>
          {/* Right Thumbnail*/}
          <div className="w-[100px] h-[70px] m-2 bg-gray-500 flex items-center justify-center rounded-lg relative cursor-pointer overflow-hidden">
            <img className="absolute w-full h-full object-fit opacity-70 transition-opacity" src={`https://picsum.photos/200/300`} alt="Thumbnail"/>
            <div className="absolute bg-neutral-900 text-neutral-100 bg-opacity-70 text-2xl py-0.5 px-3 rounded-lg"> ▶ </div>
          </div>
        </>
      }
    </div>
  );
}


const fakeEvents = [
  {
    title: 'Cat Appears',
    description: 'Description very very very very very very very very very very very very very very very very very very long',
    startTime: 123.12,
    type: '🐱',
    objects: ['Cat', 'Table', 'Chair', 'Lamp'],
  },
  {
    title: 'Dog Appears',
    description: 'Description',
    startTime: 178.34,
    type: '🐶',
    objects: ['Dog', 'Human', 'Table', 'Chair', 'Lamp'],
  },
  {
    title: 'Someone Moves This line very long',
    description: 'Description',
    startTime: 234.56,
    type: '👨🏻',
    objects: ['Human', 'Table', 'Phone', 'Lamp'],
  },
  {
    title: 'Light Changes',
    description: 'Description',
    startTime: 345.67,
    type: '💡',
    objects: ['Human', 'Table', 'Phone', 'Lamp'],
  },
  {
    title: 'Pet Appears',
    description: 'Description',
    startTime: 456.78,
    type: '🐶',
    objects: ['Dog', 'Human', 'Table', 'Chair', 'Lamp'],
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: '🔥',
    objects: ['Fire', 'Human', 'Table', 'Chair', 'Lamp'],
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: '🔥',
    objects: ['Fire', 'Human', 'Table', 'Chair', 'Lamp'],
  },
  {
    title: 'Something on Fire',
    description: 'Description',
    startTime: 11567.89,
    type: '💥',
    objects: ['Fire', 'Human', 'Table', 'Chair', 'Lamp'],
  },
]

const EventsList = ({ events, seekTo }) => {
  // events = fakeEvents;   // debug only
  return (
    <div
      className="min-w-[25rem] text-neutral-300 rounded-xl border-2 border-gray-500 overflow-hidden">
      {
        (events.length === 0) ?
          <div className="w-full h-full bg-gray-700 flex items-center justify-center text-gray-300">
            Upload a video to start ➡
          </div>
          :
          <div className="p-4 w-full h-full flex flex-col overflow-auto bg-gray-800">{
            events.map((event, idx) => (
              <EventBlock
                key={idx}
                event={event}
                seekTo={seekTo}
              />
            ))
          }
          </div>
      }
    </div>
  );
}

export default EventsList;