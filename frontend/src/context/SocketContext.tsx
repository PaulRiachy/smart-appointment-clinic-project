import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Socket, io } from 'socket.io-client';

import { useAuth } from './AuthContext';

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(
  undefined,
);

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { token, isAuthenticated } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSocket((currentSocket) => {
        currentSocket?.disconnect();
        return null;
      });

      setIsConnected(false);
      return undefined;
    }

    const socketClient = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token,
      },
      autoConnect: true,
    });

    const handleConnect = () => {
      setIsConnected(true);
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socketClient.on('connect', handleConnect);
    socketClient.on('disconnect', handleDisconnect);

    setSocket(socketClient);

    return () => {
      socketClient.off('connect', handleConnect);
      socketClient.off('disconnect', handleDisconnect);
      socketClient.disconnect();

      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, token]);

  const value = useMemo<SocketContextValue>(
    () => ({
      socket,
      isConnected,
    }),
    [socket, isConnected],
  );

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error(
      'useSocket must be used inside a SocketProvider.',
    );
  }

  return context;
}

export default SocketContext;