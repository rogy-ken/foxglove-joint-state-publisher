import { XMLParser } from "fast-xml-parser";

type RobotDescription = {
  robot: {
    joint?: JointInfo[];
  };
};

export type JointInfo = {
  name?: string;
  type?: string;
  center?: number;
  limit?: {
    lower?: number;
    upper?: number;
  };
};

export const getMoveableJoint = (robotDescription: string): JointInfo[] => {
  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: true,
  });
  const obj = xmlParser.parse(robotDescription) as RobotDescription;
  const revoluteJoints = obj.robot.joint
    ?.filter((joint) => joint.type !== "fixed")
    .map((joint) => ({
      name: joint.name,
      type: joint.type,
      center: ((joint.limit?.lower ?? 0) + (joint.limit?.upper ?? 0)) / 2,
      limit: {
        lower: joint.limit?.lower,
        upper: joint.limit?.upper,
      },
    }));

  return revoluteJoints ?? [];
};
