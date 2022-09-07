const puppeteer = require('puppeteer');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

const url = 'https://mmzztt.com/photo/';
const selector = 'main .uk-card';
const UA = 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36';

const MAX = 8;

const imgDir = (folder) => path.resolve(__dirname, `../images/${folder}`);
const historyPath = path.resolve(__dirname, '../log/history.txt');

const pageList = [
  // 'https://mmzztt.com/photo/18606',
  // 'https://mmzztt.com/photo/61489',
  // 'https://mmzztt.com/photo/49668',
];


function waitfn(ms) {
  console.log('---wait---', ms+'ms');
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(ms)
    }, ms);
  });
}

//获取历史记录
function getHistory() {
  let txtContent = fs.readFileSync(historyPath, 'utf-8');
  console.log('---getHistory---', txtContent);
  let list = txtContent.split(',');
  return list;
}
//写入历史记录
function writeHistory(lineStr) {
  fs.appendFileSync(historyPath, ','+lineStr);
}

//获取资源树
async function getResourceTree(page) {
  var resource = await page._client.send('Page.getResourceTree');
  return resource.frameTree;
}

//获取资源内容
async function getResourceContent(page, url) {
  const { content, base64Encoded } = await page._client.send(
      'Page.getResourceContent',
      { frameId: String(page.mainFrame()._id), url },
  );
  assert.equal(base64Encoded, true);
  return content;
}

//翻页并保存图片
async function pagerAndsaveImg(page, folder) {
  await page.waitForTimeout(1000);
  let progressVal = await page.$eval('#progressBar', p => p.value);
  console.log('------progressVal------', progressVal);
  let imgUrl = await page.$eval('figure.uk-inline img', p => p.src);
  console.log('------progressVal------', imgUrl);
  let imgName = imgUrl.match(/[A-Za-z0-9]*\.jpg/g)[0];
  const content = await getResourceContent(page, imgUrl);
  const contentBuffer = Buffer.from(content, 'base64');
  fs.writeFileSync(`${imgDir(folder)}/${folder} ${imgName}`, contentBuffer, 'base64');

  //点击翻页
  if(progressVal < 100) {
    await page.$eval('.uk-position-center-right', dom => {
      dom.click();
      return dom;
    });
    await pagerAndsaveImg(page, folder);
  }
  return imgName;
}

async function crawlerMmzztt(max) {
  const maxLen = max || MAX;
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    const historyList = getHistory();
    // const bua = await browser.userAgent();
    // console.log('--browser ua--', bua);
    await page.setUserAgent(UA);
    await page.setViewport({width: 1920, height: 1080});
    //Chrome Devtools协议 设置跳过断点
    const client = await page.target().createCDPSession();
    await client.send('Debugger.setSkipAllPauses', {skip: true});

    let list = [];
    if(!pageList.length) {
      // load page url
      await page.goto(url);
      // await waitfn(2000);
      await page.waitForTimeout(1000);
      // await page.screenshot({path: 'screenshot.png'});
      list = await page.$$eval(selector, doms => {
        let links = [];
        Array.from(doms).forEach(el => {
            let url = el.querySelector('.uk-inline.u-thumb-v').href;
            let date = el.querySelector('.uk-article-meta').innerText;
            let title = el.querySelector('.uk-card-title').innerText;
            let id = url.match(/photo\/(\d*)$/)[1];
            links.push({id, url, date, title});
        });
        return links;
      });
    } else {
      list = pageList.map(item => {
        return {
          id: item.match(/photo\/(\d*)$/)[1],
          url: item,
          date: '',
          title: '',
        }
      });
    }
    console.log('----list---', JSON.stringify(list));

    let len = pageList.length ? pageList.length : maxLen || list.length;
    for(let i=0; i<len; i++) {
      let id = list[i].id;
      let link = list[i].url;
      let folder = list[i].date ? list[i].date.split(' ')[0] : '';
      let title = list[i].title;
      if(historyList.includes(id)) {
        continue;
      }
      await page.goto(link);
      if(pageList.length) {
        await page.waitForTimeout(1000);
        title = await page.$eval('.uk-article-title', el => el.innerText);
        list[i].date = await page.$eval('.uk-article-meta time', el => el.innerText);
        folder = list[i].date.split(' ')[0];
      }
      if(!fs.existsSync(imgDir(folder))) fs.mkdirSync(imgDir(folder));
      fs.writeFileSync(`${imgDir(folder)}/${title}.txt`, title);
      console.log('----title-----', title, link);
      await pagerAndsaveImg(page, folder);
      //写入记录
      writeHistory(id);
    }

    //关闭
    await browser.close(); 
  } catch(err) {
    console.log('-----error-----', err);
    //关闭
    await browser.close();
  }
};

module.exports = crawlerMmzztt;
