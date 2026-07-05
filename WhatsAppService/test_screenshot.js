const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080 });
    
    let html = fs.readFileSync(path.join(__dirname, 'poster_template.html'), 'utf8');
    html = html.replace('{{PHOTO_BASE64}}', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=')
               .replace('{{EMPLOYEE_NAME}}', 'Kinnari');
               
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const element = await page.$('#poster');
    await element.screenshot({ path: 'test_screenshot.png' });
    
    await browser.close();
    console.log('Screenshot saved to test_screenshot.png');
})();
