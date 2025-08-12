module.exports = [
  'strapi::errors',
  { name:'strapi::security', config:{ contentSecurityPolicy:{ useDefaults:true } } },
  {
    name:'strapi::cors',
    config:{
      origin:[
        'http://localhost:3000',
        'https://effort-free.co.uk',
        'https://www.effort-free.co.uk',
        /https:\/\/.*\.vercel\.app$/
      ],
      credentials:true,
      methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
      headers:'*',
    },
  },
  'strapi::poweredBy','strapi::logger','strapi::query','strapi::body','strapi::session','strapi::favicon','strapi::public',
];
