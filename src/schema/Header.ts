export type Header = {
  stamp: {
    sec: number;
    nanosec: number;
  };
  frame_id: string;
};

export const makeHeader = (frame_id = ""): Header => {
  const currentUnixTimeMs = new Date().getTime();

  return {
    stamp: {
      sec: Math.floor(currentUnixTimeMs / 1000),
      nanosec: (currentUnixTimeMs % 1000) * 1e6,
    },
    frame_id,
  };
};
