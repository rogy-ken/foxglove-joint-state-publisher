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
import produce from "immer";
import { set } from "lodash";
import { useLayoutEffect, useEffect, useState } from "react";
import ReactDOM from "react-dom";

import { JointInfo, getMoveableJoint } from "./RobotDescription";
import { makeHeader } from "./schema/Header";
import { JointState } from "./schema/JointState";

type State = {
  topic: {
    name?: string;
  };
};

type StringMessage = MessageEvent<{ data: string }>;

function JointStatePublisherPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [jointInfos, setJointInfos] = useState<JointInfo[]>();
  const [jointState, setJointState] = useState<JointState>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();
  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  context.watch("topics");
  context.watch("currentFrame");

  context.onRender = (renderState, done) => {
    setRenderDone(() => done);
    setTopics(renderState.topics);
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

  if (context.advertise) {
    context.advertise("/joint_states", "sensor_msgs/msg/JointState");
  }

  // Build our panel state from the context's initialState, filling in any possibly missing values.
  const [state, setState] = useState<State>(() => {
    const partialState = context.initialState as Partial<State>;
    return {
      topic: {
        name: partialState.topic?.name ?? "/robot_description",
      },
    };
  });

  // Update the settings editor every time our state or the list of available topics changes.
  useEffect(() => {
    const actionHandler = (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        setState(produce((draft: State) => set(draft, path, value)));
        context.saveState(state);
      }
    };

    const topicOptions = (topics ?? [])
      .filter((topic) => topic.schemaName === "std_msgs/msg/String")
      .map((topic) => ({ value: topic.name, label: topic.name }));

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        topic: {
          label: "Topic",
          icon: "Cube",
          fields: {
            name: {
              label: "Topic",
              input: "select",
              options: topicOptions,
              value: state.topic.name,
            },
          },
        },
      },
    });
  }, [context, state, topics]);

  useLayoutEffect(() => {
    if (state.topic.name) {
      context.subscribe([{ topic: state.topic.name }]);
    }
  }, [context, state.topic.name]);

  useEffect(() => {
    if (!context.publish || !jointState) {
      return;
    }
    jointState.header = makeHeader();
    context.publish("/joint_states", jointState);
  }, [context, jointState]);

  return (
    <div style={{ padding: "1rem", display: "flex", flexDirection: "column", maxHeight: "100%" }}>
      <ChakraProvider>
        <VStack spacing="15px">
          {jointInfos?.map((joint, index) => (
            <Box key={joint.name} w="100%">
              <div>
                {joint.name}: {jointState?.position[index]}
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
