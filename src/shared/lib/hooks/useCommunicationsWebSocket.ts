import { useEffect, useRef } from "react";
import { connectCommunicationsWebSocket } from "@/shared/lib/commsWebSocket";
import type { CommsMessageNewEvent } from "@/shared/lib/organizationOrgDialogs";

export function useCommunicationsWebSocket(
  enabled: boolean,
  onMessageNew: (event: CommsMessageNewEvent) => void
) {
  const onMessageNewRef = useRef(onMessageNew);
  onMessageNewRef.current = onMessageNew;

  useEffect(() => {
    return connectCommunicationsWebSocket({
      enabled,
      onMessageNew: (event) => onMessageNewRef.current(event),
    });
  }, [enabled]);
}
