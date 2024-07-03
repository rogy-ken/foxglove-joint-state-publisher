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
import { useLayoutEffect, useEffect, useState, useCallback } from "react";
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

function ExamplePanel({ context }: { context: PanelExtensionContext }): JSX.Element {
  const [topics, setTopics] = useState<readonly Topic[] | undefined>();
  const [jointInfos, setJointInfos] = useState<JointInfo[]>();
  const [jointState, setJointState] = useState<JointState>();

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  // Build our panel state from the context's initialState, filling in any possibly missing values.
  const [state, setState] = useState<State>(() => {
    const partialState = context.initialState as Partial<State>;
    return {
      topic: {
        name: partialState.topic?.name ?? "/robot_description",
      },
    };
  });

  // Respond to actions from the settings editor to update our state.
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action === "update") {
        const { path, value } = action.payload;
        setState(produce((draft: State) => set(draft, path, value)));

        if (path[0] === "topic") {
          context.subscribe([{ topic: value as string }]);
        }
      }
    },
    [context],
  );

  // Update the settings editor every time our state or the list of available topics changes.
  useEffect(() => {
    context.saveState(state);

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
  }, [context, actionHandler, state, topics]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic
  // subscriptions.
  useLayoutEffect(() => {
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
    context.watch("topics");
    context.watch("currentFrame");

    if (state.topic.name) {
      context.subscribe([{ topic: state.topic.name }]);
    }
  }, [context, state.topic.name]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  useEffect(() => {
    if (context.advertise) {
      context.advertise("/joint_states", "sensor_msgs/msg/JointState");
    }
  });

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

export function initExamplePanel(context: PanelExtensionContext): () => void {
  ReactDOM.render(<ExamplePanel context={context} />, context.panelElement);

  // Return a function to run when the panel is removed
  return () => {
    ReactDOM.unmountComponentAtNode(context.panelElement);
  };
}
