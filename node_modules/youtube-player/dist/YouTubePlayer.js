'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

var _FunctionStateMap = require('./FunctionStateMap');

var _FunctionStateMap2 = _interopRequireDefault(_FunctionStateMap);

var _eventNames = require('./eventNames');

var _eventNames2 = _interopRequireDefault(_eventNames);

var _functionNames = require('./functionNames');

var _functionNames2 = _interopRequireDefault(_functionNames);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable promise/prefer-await-to-then */

const debug = (0, _debug2.default)('youtube-player');

const YouTubePlayer = {};

/**
 * Construct an object that defines an event handler for all of the YouTube
 * player events. Proxy captured events through an event emitter.
 *
 * @todo Capture event parameters.
 * @see https://developers.google.com/youtube/iframe_api_reference#Events
 */
YouTubePlayer.proxyEvents = emitter => {
  const events = {};

  for (const eventName of _eventNames2.default) {
    const onEventName = 'on' + eventName.slice(0, 1).toUpperCase() + eventName.slice(1);

    events[onEventName] = event => {
      debug('event "%s"', onEventName, event);

      emitter.trigger(eventName, event);
    };
  }

  return events;
};

/**
 * Delays player API method execution until player state is ready.
 *
 * @todo Proxy all of the methods using Object.keys.
 * @todo See TRICKY below.
 * @param playerAPIReady Promise that resolves when player is ready.
 * @param strictState A flag designating whether or not to wait for
 * an acceptable state when calling supported functions.
 * @returns {object}
 */
YouTubePlayer.promisifyPlayer = (playerAPIReady, strictState = false) => {
  const functions = {};

  for (const functionName of _functionNames2.default) {
    if (strictState && _FunctionStateMap2.default[functionName]) {
      functions[functionName] = (...args) => {
        return playerAPIReady.then(player => {
          const stateInfo = _FunctionStateMap2.default[functionName];
          const playerState = player.getPlayerState();

          // eslint-disable-next-line no-warning-comments
          // TODO: Just spread the args into the function once Babel is fixed:
          // https://github.com/babel/babel/issues/4270
          //
          // eslint-disable-next-line prefer-spread
          const value = player[functionName].apply(player, args);

          // TRICKY: For functions like `seekTo`, a change in state must be
          // triggered given that the resulting state could match the initial
          // state.
          if (stateInfo.stateChangeRequired ||

          // eslint-disable-next-line no-extra-parens
          Array.isArray(stateInfo.acceptableStates) && !stateInfo.acceptableStates.includes(playerState)) {
            return new Promise(resolve => {
              const onPlayerStateChange = () => {
                const playerStateAfterChange = player.getPlayerState();

                let timeout;

                if (typeof stateInfo.timeout === 'number') {
                  timeout = setTimeout(() => {
                    player.removeEventListener('onStateChange', onPlayerStateChange);

                    resolve();
                  }, stateInfo.timeout);
                }

                if (Array.isArray(stateInfo.acceptableStates) && stateInfo.acceptableStates.includes(playerStateAfterChange)) {
                  player.removeEventListener('onStateChange', onPlayerStateChange);

                  clearTimeout(timeout);

                  resolve();
                }
              };

              player.addEventListener('onStateChange', onPlayerStateChange);
            }).then(() => {
              return value;
            });
          }

          return value;
        });
      };
    } else {
      functions[functionName] = (...args) => {
        return playerAPIReady.then(player => {
          // eslint-disable-next-line no-warning-comments
          // TODO: Just spread the args into the function once Babel is fixed:
          // https://github.com/babel/babel/issues/4270
          //
          // eslint-disable-next-line prefer-spread
          return player[functionName].apply(player, args);
        });
      };
    }
  }

  return functions;
};

exports.default = YouTubePlayer;
module.exports = exports['default'];