'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/xdebug',
      handler: 'xdebug.ping',
      config: { auth: false },
    },
  ],
};
