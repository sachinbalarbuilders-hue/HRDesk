const fs = require("fs");
const path = require("path");

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith(".tsx") || file.endsWith(".ts")) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk("d:/HRDesk/web-client/src");
let count = 0;
for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    if (content.includes("â€”") || content.includes("â‚¹")) {
        content = content.replace(/â€”/g, "—").replace(/â‚¹/g, "₹");
        fs.writeFileSync(file, content, "utf8");
        count++;
    }
}
console.log(`Updated ${count} files.`);
