const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  "d:/HRDesk/web-client/src/pages/Shifts.tsx",
  "d:/HRDesk/web-client/src/pages/superadmin/SuperAdminDashboard.tsx",
  "d:/HRDesk/web-client/src/pages/superadmin/BillingTab.tsx",
  "d:/HRDesk/web-client/src/pages/settings/SubscriptionTab.tsx",
  "d:/HRDesk/web-client/src/pages/Regularizations.tsx",
  "d:/HRDesk/web-client/src/pages/Recruitment.tsx",
  "d:/HRDesk/web-client/src/pages/LandingPage.tsx",
  "d:/HRDesk/web-client/src/pages/GuardScanner.tsx",
  "d:/HRDesk/web-client/src/pages/Dashboard.tsx",
  "d:/HRDesk/web-client/src/pages/Attendance.tsx",
  "d:/HRDesk/web-client/src/components/employees/EmployeeIdCardTab.tsx",
  "d:/HRDesk/web-client/src/components/employees/EmployeeDocumentsTab.tsx",
  "d:/HRDesk/web-client/src/components/payroll/TaxDeclarationModal.tsx"
];

for (const file of filesToUpdate) {
  let content = fs.readFileSync(file, 'utf-8');
  let originalContent = content;

  // Simple regex to catch `new Date(X).toLocaleDateString()` and replace with `formatDate(X)`
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleDateString\([^)]*\)/g, 'formatDate($1)');
  content = content.replace(/new Date\(\)\.toLocaleDateString\([^)]*\)/g, 'formatDate(new Date())');
  
  content = content.replace(/new Date\(([^)]+)\)\.toLocaleTimeString\([^)]*\)/g, 'formatTime($1)');
  content = content.replace(/new Date\(\)\.toLocaleTimeString\([^)]*\)/g, 'formatTime(new Date())');
  
  // also `currentTime.toLocaleTimeString` => `formatTime(currentTime)`
  content = content.replace(/currentTime\.toLocaleTimeString\([^)]*\)/g, 'formatTime(currentTime)');
  content = content.replace(/currentTime\.toLocaleDateString\([^)]*\)/g, 'formatDate(currentTime)');
  
  // and `weekDays[0].toLocaleDateString` => `formatDate(weekDays[0])`
  content = content.replace(/weekDays\[(\d+)\]\.toLocaleDateString\([^)]*\)/g, 'formatDate(weekDays[$1])');
  content = content.replace(/d\.toLocaleDateString\([^)]*\)/g, 'formatDate(d)');
  content = content.replace(/dDate\.toLocaleDateString\([^)]*\)/g, 'formatDate(dDate)');

  // Ensure imports are added if they were used
  const needsFormatDate = content.includes('formatDate(') && !content.includes('formatDate');
  // Wait, if it includes 'formatDate(' it already includes 'formatDate'.
  const missingFormatDate = content.includes('formatDate(') && !originalContent.includes('formatDate');
  const missingFormatTime = content.includes('formatTime(') && !originalContent.includes('formatTime');

  if (content !== originalContent) {
    let relativeLevels = file.split('/').length - 5; // web-client/src/ is depth 4. pages/ is depth 5
    // Actually, let's just calculate path to src/utils/formatters
    let srcIndex = file.indexOf('/src/');
    let relativePathToSrc = path.relative(path.dirname(file), path.join(file.substring(0, srcIndex), 'src'));
    let formatterImportPath = (relativePathToSrc === '' ? '.' : relativePathToSrc) + '/utils/formatters';
    formatterImportPath = formatterImportPath.replace(/\\/g, '/');
    if (!formatterImportPath.startsWith('.')) formatterImportPath = './' + formatterImportPath;

    const importsToAdd = [];
    if (!originalContent.includes('formatDate') && content.includes('formatDate(')) importsToAdd.push('formatDate');
    if (!originalContent.includes('formatTime') && content.includes('formatTime(')) importsToAdd.push('formatTime');

    if (importsToAdd.length > 0) {
      // Find the last import line
      const importMatches = [...content.matchAll(/^import .*?;$/gm)];
      if (importMatches.length > 0) {
        const lastMatch = importMatches[importMatches.length - 1];
        const insertPos = lastMatch.index + lastMatch[0].length;
        content = content.substring(0, insertPos) + `\nimport { ${importsToAdd.join(', ')} } from '${formatterImportPath}';` + content.substring(insertPos);
      } else {
        content = `import { ${importsToAdd.join(', ')} } from '${formatterImportPath}';\n` + content;
      }
    }
    
    fs.writeFileSync(file, content);
    console.log('Updated ' + path.basename(file));
  }
}
