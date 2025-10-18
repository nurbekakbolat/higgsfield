import React, { type Dispatch } from "react";

interface GenerationParamsInputProps {
  topic: string;
  setTopic: Dispatch<React.SetStateAction<string>>;
  style: string;
  setStyle: Dispatch<React.SetStateAction<string>>;
  count: number;
  setCount: Dispatch<React.SetStateAction<number>>;
}

export const GenerationParamsInput = ({
  topic,
  setTopic,
  style,
  setStyle,
  count,
  setCount,
}: GenerationParamsInputProps) => {
  return (
    <>
      <input
        type="text"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder='e.g. "create 6 slides about global warming"'
        className="w-full border p-3 rounded-md text-black"
      />

      <input
        type="text"
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        placeholder='Optional style, e.g. "isometric 3D corporate", or leave blank'
        className="w-full border p-3 rounded-md text-black"
      />

      <div className="flex items-center gap-3">
        <label className="text-gray-700">Slides:</label>
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(e) => setCount(parseInt(e.target.value || "6", 10))}
          className="w-24 border p-2 rounded-md text-black"
        />
      </div>
    </>
  );
};
