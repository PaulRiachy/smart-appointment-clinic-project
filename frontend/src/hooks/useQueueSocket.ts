import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';

export type QueueSocketEvent =
  | 'queue:update'
  | 'queue:call'
  | 'queue:complete';

export interface QueueSocketUpdate {
  event: QueueSocketEvent;
  payload: unknown;
  receivedAt: Date;
}

interface UseQueueSocketOptions {
  onQueueUpdate?: (update: QueueSocketUpdate) => void;
}

export function useQueueSocket(
  options: UseQueueSocketOptions = {},
) {
  const { socket, isConnected } = useSocket();
  const [lastUpdate, setLastUpdate] =
    useState<QueueSocketUpdate | null>(null);

  const callbackRef = useRef(options.onQueueUpdate);

  useEffect(() => {
    callbackRef.current = options.onQueueUpdate;
  }, [options.onQueueUpdate]);

  const handleQueueEvent = useCallback(
    (event: QueueSocketEvent, payload: unknown) => {
      const update: QueueSocketUpdate = {
        event,
        payload,
        receivedAt: new Date(),
      };

      setLastUpdate(update);
      callbackRef.current?.(update);
    },
    [],
  );

  useEffect(() => {
    if (!socket || typeof socket.on !== 'function') {
      return undefined;
    }

    const handleUpdate = (payload: unknown) =>
      handleQueueEvent('queue:update', payload);

    const handleCall = (payload: unknown) =>
      handleQueueEvent('queue:call', payload);

    const handleComplete = (payload: unknown) =>
      handleQueueEvent('queue:complete', payload);

    socket.on('queue:update', handleUpdate);
    socket.on('queue:call', handleCall);
    socket.on('queue:complete', handleComplete);

    return () => {
      socket.off('queue:update', handleUpdate);
      socket.off('queue:call', handleCall);
      socket.off('queue:complete', handleComplete);
    };
  }, [socket, handleQueueEvent]);

  return {
    isConnected,
    lastUpdate,
  };
}

export default useQueueSocket;