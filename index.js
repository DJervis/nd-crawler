const argvs = process.argv.slice(2);
const argvObj = {};
argvs.forEach(item => {
  let arr = item.split('=');
  argvObj[arr[0]] = arr[1];
});
console.log('----argvObj----', argvObj);

if(argvObj.type == 'pup') {
  const crawlerMmzztt = require('./src/puppeteer');
  crawlerMmzztt(argvObj.max);
}