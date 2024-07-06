/* eslint-disable react-hooks/exhaustive-deps */
import {
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  ChakraProvider,
  VStack,
  Box,
} from "@chakra-ui/react";
import { PanelExtensionContext, Topic, MessageEvent, SettingsTreeAction } from "@foxglove/studio";
import { set } from "lodash";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import { JointInfo, getMoveableJoint } from "./RobotDescription";
import { makeHeader } from "./schema/Header";
import { JointState } from "./schema/JointState";

type State = {
  robotDescription: {
    topic: string;
  };
  publish: {
    topic: string;
    hz: number;
  };
};

type StringMessage = MessageEvent<{ data: string }>;

function JointStatePublisherPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[]>([]);
  const [jointInfos, setJointInfos] = useState<JointInfo[]>([]);
  const [jointState, setJointState] = useState<JointState>();
  const jointStateRef = useRef<JointState>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  context.watch("topics");
  context.watch("currentFrame");

  context.onRender = (renderState, done) => {
    setRenderDone(() => done);
    setTopics(renderState.topics ?? []);
    if (renderState.currentFrame && renderState.currentFrame.length > 0) {
      const message = renderState.currentFrame[
        renderState.currentFrame.length - 1
      ] as StringMessage;
      const joints = getMoveableJoint(message.message.data);
      setJointInfos(joints);
      setJointState({
        name: joints.map((joint) => joint.name ?? ""),
        position: joints.map((joint) => joint.center ?? 0),
      });
    }
  };

  // Build our panel state from the context's initialState, filling in any possibly missing values.
  const [state, setState] = useState<State>(() => {
    const partialState = context.initialState as Partial<State>;
    return {
      robotDescription: {
        topic: partialState.robotDescription?.topic ?? "/robot_description",
      },
      publish: {
        topic: partialState.publish?.topic ?? "/joint_states",
        hz: partialState.publish?.hz ?? 30,
      },
    };
  });

  // Update the settings editor every time our state or the list of available topics changes.
  useEffect(() => {
    const topicOptions = topics
      .filter((topic) => topic.schemaName === "std_msgs/msg/String")
      .map((topic) => ({ value: topic.name, label: topic.name }));

    context.updatePanelSettingsEditor({
      nodes: {
        robotDescription: {
          label: "Robot Description",
          icon: "Cube",
          fields: {
            topic: {
              label: "Topic",
              input: "select",
              options: topicOptions,
              value: state.robotDescription.topic,
            },
          },
        },
        publish: {
          label: "Publish",
          icon: "Cube",
          fields: {
            topic: {
              label: "Topic",
              input: "string",
              value: state.publish.topic,
            },
            hz: {
              label: "Hz",
              input: "number",
              value: state.publish.hz,
              step: 1,
              max: 100,
              min: 1,
            },
          },
        },
      },
      actionHandler: (action: SettingsTreeAction) => {
        if (action.action === "update") {
          const { path, value } = action.payload;
          setState(structuredClone(set(state, path, value)));
        }
      },
    });
  }, [state, topics]);

  useEffect(() => {
    context.saveState(state);

    if (state.robotDescription.topic) {
      context.subscribe([{ topic: state.robotDescription.topic }]);
    }
    if (context.advertise) {
      context.advertise(state.publish.topic, "sensor_msgs/msg/JointState");
    }

    const publishIntervalId = setInterval(() => {
      if (!context.publish || !jointStateRef.current) {
        return;
      }
      jointStateRef.current.header = makeHeader();
      context.publish(state.publish.topic, jointStateRef.current);
    }, 1000 / state.publish.hz);

    return () => {
      clearInterval(publishIntervalId);
    };
  }, [state]);

  useEffect(() => {
    jointStateRef.current = jointState;
  }, [jointState]);

  return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", maxHeight: "100%" }}>
      <ChakraProvider>
        <VStack spacing="15px">
          {jointInfos.map((joint, index) => (
            <Box key={joint.name} w="100%">
              <div>
                {joint.name}: {jointState?.position[index]?.toFixed(2)}
              </div>
              <Slider
                aria-label={joint.name}
                defaultValue={jointState?.position[index]}
                onChange={(value) => {
                  if (jointState) {
                    jointState.position[index] = value;
                    setJointState(structuredClone(jointState));
                  }
                }}
                min={joint.limit?.lower ?? -10}
                max={joint.limit?.upper ?? 10}
                step={0.01}
              >
                <SliderTrack>
                  <SliderFilledTrack />
                </SliderTrack>
                <SliderThumb />
              </Slider>
            </Box>
          ))}
        </VStack>
      </ChakraProvider>
    </div>
  );
}

export function initJointStatePublisherPanel(context: PanelExtensionContext): () => void {
  ReactDOM.render(<JointStatePublisherPanel context={context} />, context.panelElement);

  // Return a function to run when the panel is removed
  return () => {
    ReactDOM.unmountComponentAtNode(context.panelElement);
  };
}
