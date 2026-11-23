import config from '@colyseus/tools';
import { createGeminiHandler } from './geminiHandler';
import { IslandRoom } from './rooms/IslandRoom';

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define('island', IslandRoom);
  },
  initializeExpress: (app) => {
    const geminiHandler = createGeminiHandler(process.env);
    app.post('/api/generate', (req, res) => {
      geminiHandler(req, res);
    });
  },
});
