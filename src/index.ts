import { ExtensionContext } from "@foxglove/extension";

import { initJointStatePublisherPanel } from "./JointStatePublisherPanel";

export function activate(extensionContext: ExtensionContext): void {
  extensionContext.registerPanel({
    name: "Joint State Publisher",
    initPanel: initJointStatePublisherPanel,
  });
}
