var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
  name:'HRDesk WhatsApp Service',
  description: 'Node.js WhatsApp Web microservice for HRDesk notification queue.',
  script: 'C:\\HRServices\\WhatsAppService\\index.js',
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=1024'
  ]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install',function(){
  console.log('Install complete. Starting service...');
  svc.start();
});

// Listen for the "alreadyinstalled" event
svc.on('alreadyinstalled',function(){
  console.log('Service is already installed. Attempting to restart...');
  svc.restart();
});

console.log('Installing WhatsApp Windows Service...');
svc.install();
