import React, { useRef, useState, useEffect } from 'react';


const formatSeconds = (seconds) => {
  /*
    Format like: `09:03:12` or `03:12` if hours is 0
    * Input: Number of seconds
    * Output: String of formatted time
   */
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = Math.floor(seconds) % 60;
  if (h === 0)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const textToColor = (text) => {
  /*
    Generate a color from the hash of the text
    * Input: String of Any text
    * Output: String of TailwindCSS color class
   */
  const colors = ["bg-red-200", "bg-orange-200", "bg-yellow-200", "bg-lime-200", "bg-green-200", "bg-teal-200", "bg-blue-200", "bg-indigo-200", "bg-purple-200", "bg-pink-200"];
  const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
}


const EventsFilter = ({ events, deselectedTags, setDeselectedTags }) => {

  const allTags = (() => {
    let tags = events.flatMap(event => event.tags);
    let distinctTags = [...new Set(tags)];
    let tagsWithCountAndFlag = distinctTags.map(object => ({
      name: object,
      count: tags.filter(o => o === object).length,
      deselected: deselectedTags.includes(object),
    }));
    tagsWithCountAndFlag.sort((a, b) => {
      // Sort by count, then by name
      if (a.count === b.count) {
        return (a.name < b.name) ? -1 : 1;
      } else {
        return b.count - a.count;
      }
    })
    return tagsWithCountAndFlag;
  })();

  return (
    <div className="shadow-md shadow-gray-800 z-10">
      {/* Filter Header */}
      {(allTags.length === 0)
        ?
        <p className="text-lg font-bold text-gray-300 p-2 px-4 bg-gray-700 m-0">
          Events List
        </p>
        :
        <>
          <div className="flex justify-between items-center gap-2 mx-4">
            <div className="flex-1 mt-2 mb-1 text-lg font-bold">
              Tags Filter
            </div>
            <div
              onClick={() => setDeselectedTags([])}
              className="mt-2 mb-1 p-1 px-2 text-xs font-bold bg-gray-700 rounded-xl hover:bg-gray-600 cursor-pointer">
              Select All
            </div>
            <div
              onClick={() => setDeselectedTags(allTags.map(o => o.name))}
              className="mt-2 mb-1 p-1 px-2 text-xs font-bold bg-red-600 rounded-xl hover:bg-red-500 cursor-pointer">
              Clear All
            </div>
          </div>
          {/* Divider */}
          <div className="mb-2 mx-3 border-b-[0.5px] border-gray-700"/>
          {/* Toggleable Tags */}
          <div className="mx-4 flex flex-wrap max-h-[6.7rem] overflow-auto">
            {
              allTags.map((tag) => (
                <div
                  key={tag.name}
                  className={`m-1 mb-1 px-2 py-0.5 text-sm rounded-lg bg-gray-800 cursor-pointer hover:bg-gray-700 ${tag.deselected && 'line-through text-red-400'}`}
                  onClick={() => {
                    // Toggle shown flag
                    if (tag.deselected) {
                      setDeselectedTags(deselectedTags.filter(o => o !== tag.name));
                    } else {
                      setDeselectedTags([...deselectedTags, tag.name]);
                    }
                  }}
                >
                  {tag.name} ({tag.count})
                </div>
              ))
            }
          </div>
          {/* Spacer */}
          <div className="h-2"/>
        </>
      }
    </div>
  );
}


const EventBlock = ({ event, seekTo }) => {
  //
  // Layout when not hovered:
  //   *------------------------------------*
  //   |          | Title       |           |
  //   |   Icon   |             | Thumbnail |
  //   |          | StartTime   |           |
  //   *------------------------------------*
  // Layout when hovered:
  //   *------------------------------------*
  //   |                        |           |
  //   |       Description      | Thumbnail |
  //   |                        |           |
  //   *------------------------------------*
  //
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
          <div className={`${textToColor(event.type)} text-red-600 w-[50px] h-[50px] mx-4 my-4 bg-gray-500 rounded-full flex items-center justify-center text-2xl`}>
            {event.type}
          </div>
          {/* Middle Text*/}
          <div className="mr-1">
            <p className="text-md font-bold max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis">{event.title}</p>
            <p className="text-xs mb-[2px] max-w-[160px] overflow-hidden whitespace-nowrap overflow-ellipsis text-yellow-500">{event.tags.join(", ")}</p> {/* FIXME: DEBUG */}
            <p className="text-sm">{formatSeconds(event.startTime)}</p>
          </div>
          {/* Space */}
          <div className="flex-1"/>
          {/* Right Thumbnail*/}
          <div className="w-[100px] h-[70px] m-2 bg-gray-500 flex items-center justify-center rounded-lg relative cursor-pointer overflow-hidden">
            <img className="absolute w-full h-full object-fit" src={event.thumbnailURL} alt="Thumbnail"/>
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
            <img className="absolute w-full h-full object-fit opacity-70 transition-opacity" src={event.thumbnailURL} alt="Thumbnail"/>
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
    objects: ['Cat', 'Table', 'Chair', 'Lamp', "A", "B", "C"],
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

  const [deselectedTags, setDeselectedTags] = useState([]);

  return (
    <div className="w-[25rem] text-neutral-300 rounded-xl border-2 border-gray-500 overflow-hidden flex flex-col">
      <>
        <EventsFilter
          events={events}
          deselectedTags={deselectedTags}
          setDeselectedTags={setDeselectedTags}
        />
        <div className="p-4 py-2 w-full h-full flex flex-col overflow-auto bg-gray-800 flex-1">
          {
            (events.length === 0) ?
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                No events found yet
              </div>
              :
              events
                .filter((event) => {
                  if (event.tags.length === 0) {
                    return true;    // Show events without objects
                  }
                  const isDeslected = event.tags.map(o => deselectedTags.includes(o));
                  const isAllDeselected = isDeslected.reduce((a, b) => a && b, true);
                  return isAllDeselected === false;
                })
                .map((event, idx) => (
                  <EventBlock
                    key={idx}
                    event={event}
                    seekTo={seekTo}
                  />
                ))
          }
        </div>
      </>

    </div>
  );
}

export default EventsList;