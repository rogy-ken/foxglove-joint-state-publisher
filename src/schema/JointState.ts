import { Header } from "./Header";

export type JointState = {
  header?: Header;
  /** Frame of reference */
  frame_id?: string;

  name: string[];

  position: number[];

  velocity?: number[];

  effort?: number[];
};
