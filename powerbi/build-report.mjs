// Deterministic PBIR generator for the ROW Clearing Plan report.
// Reads the locked design brief (_brief/report-spec.md) intent, encoded here as
// data, and writes page.json + visual.json for all 6 pages. Re-runnable.
// Run: node powerbi/build-report.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('powerbi/row_pbi_poc.Report/definition');
const PAGES_DIR = path.join(ROOT, 'pages');
const V = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json';
const PAGE_SCHEMA = 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json';

// ---- BrilliT tokens ----
const C = {
  navy: '#002f6e', logoBlue: '#015a9c', green: '#00c18c', greenText: '#007f5b',
  heading: '#193768', page: '#f3f5f8', card: '#ffffff', border: '#d9dde3',
  headerText: '#ffffff', subtitle: '#cfe0f2', textPrimary: '#202124',
  bad: '#d03b3b', warning: '#fab219',
};

const id = () => crypto.randomBytes(10).toString('hex');
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const num = (n) => lit(`${n}D`);
const str = (s) => lit(`'${s}'`);
const bool = (b) => lit(`${b}`);
const solid = (hex) => ({ solid: { color: str(hex) } });

const col = (entity, prop) => ({ field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } }, queryRef: `${entity}.${prop}`, nativeQueryRef: prop });
const meas = (prop, entity = '@Measures') => ({ field: { Measure: { Expression: { SourceRef: { Entity: entity } }, Property: prop } }, queryRef: `${entity}.${prop}`, nativeQueryRef: prop });

let Z = 1000;
const pos = (x, y, w, h) => ({ x, y, z: (Z += 10), width: w, height: h, tabOrder: Z });

// ---- framework pieces ----
function shapeRect(x, y, w, h, fill, showOutline = false, outlineColor = C.border) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'shape',
      objects: {
        shape: [{ properties: { tileShape: str('rectangle') } }],
        fill: [{ properties: { fillColor: solid(fill), transparency: num(0) }, selector: { id: 'default' } }],
        outline: [{ properties: { show: bool(showOutline), lineColor: solid(outlineColor) }, selector: { id: 'default' } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: bool(false) } }],
        border: [{ properties: { show: bool(false) } }],
        padding: [{ properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) } }],
      },
    },
  };
}

function logo(x, y, w, h) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'image',
      objects: { general: [{ properties: { imageUrl: { expr: { ResourcePackageItem: { PackageName: 'RegisteredResources', PackageType: 1, ItemName: 'brillit-logo.png' } } } } }],
        imageScaling: [{ properties: { imageScalingType: str('Fit') } }] },
      visualContainerObjects: { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }] },
      drillFilterOtherVisuals: true,
    },
  };
}

function textbox(x, y, w, h, text, { size = '24px', color = C.headerText, bold = true, align = 'left' } = {}) {
  const run = { value: text, textStyle: { fontFamily: bold ? 'Arial' : 'Arial', fontSize: size, color } };
  if (bold) run.textStyle.fontWeight = 'bold';
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'textbox',
      objects: { general: [{ properties: { paragraphs: [{ textRuns: [run], horizontalTextAlignment: align }] } }] },
      visualContainerObjects: {
        background: [{ properties: { show: bool(false) } }],
        border: [{ properties: { show: bool(false) } }],
        padding: [{ properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) } }],
      },
    },
  };
}

function pageNavigator(x, y, w, h) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'pageNavigator',
      objects: {
        pages: [{ properties: { showHiddenPages: bool(false), showTooltipPages: bool(false) } }],
        text: [{ properties: { fontFamily: str('Arial'), fontSize: num(11), bold: bool(true), fontColor: solid(C.heading) }, selector: { id: 'default' } }],
        fill: [{ properties: { show: bool(false) } }],
      },
      visualContainerObjects: { background: [{ properties: { show: bool(false) } }], border: [{ properties: { show: bool(false) } }] },
    },
  };
}

function button(x, y, w, h, label, linkProps, { fill = null, fontColor = C.headerText } = {}) {
  const fillEntries = fill
    ? [{ properties: { show: bool(true) } }, { properties: { fillColor: solid(fill) }, selector: { id: 'default' } }]
    : [{ properties: { show: bool(false) } }];
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'actionButton',
      objects: {
        text: [{ properties: { show: bool(true) } }, { properties: { text: str(label), fontFamily: str('Arial'), fontSize: num(11), fontColor: solid(fontColor), horizontalAlignment: str('center') }, selector: { id: 'default' } }],
        icon: [{ properties: { show: bool(false) } }, { properties: { shapeType: str('rightArrow'), placement: str('left') }, selector: { id: 'default' } }],
        fill: fillEntries,
        outline: [{ properties: { show: bool(fill ? false : true), lineColor: solid(C.headerText), weight: num(1) }, selector: { id: 'default' } }],
        shape: [{ properties: { tileShape: str('rectangleRounded'), roundEdge: lit('6L') } }, { properties: { tileShape: str('rectangleRounded') }, selector: { id: 'default' } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: bool(false) } }],
        border: [{ properties: { show: bool(false) } }],
        visualLink: [{ properties: { show: bool(true), ...linkProps } }],
      },
      drillFilterOtherVisuals: true,
    },
    howCreated: 'InsertVisualButton',
  };
}

function slicer(x, y, w, h, entity, prop, header) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'slicer',
      query: { queryState: { Values: { projections: [col(entity, prop)] } } },
      objects: {
        data: [{ properties: { mode: str('Dropdown') } }],
        header: [{ properties: { show: bool(true), text: str(header), fontColor: solid(C.textPrimary) } }],
      },
      visualContainerObjects: {
        background: [{ properties: { show: bool(true), color: solid(C.card), transparency: num(0) } }],
        padding: [{ properties: { top: num(0), bottom: num(0), left: num(0), right: num(0) } }],
      },
    },
  };
}

function card(x, y, w, h, measures) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'cardVisual',
      query: { queryState: { Data: { projections: measures.map((m) => meas(m)) } } },
      objects: {
        accentBar: [{ properties: { show: bool(true), position: str('Left'), color: solid(C.green), width: num(4) }, selector: { id: 'default' } }],
        value: [{ properties: { fontSize: num(28) }, selector: { id: 'default' } }],
        label: [{ properties: { fontSize: num(11) }, selector: { id: 'default' } }],
      },
      visualContainerObjects: { general: [{ properties: { altText: str(`KPI cards: ${measures.join(', ')}.`) } }] },
    },
  };
}

function notBlankFilter(entity, prop) {
  const fname = 'Filter' + crypto.randomBytes(12).toString('hex');
  return { filters: [{
    name: fname,
    field: { Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } },
    type: 'Advanced',
    filter: { Version: 2, From: [{ Name: 'f', Entity: entity, Type: 0 }], Where: [{ Condition: { Not: { Expression: { Comparison: {
      ComparisonKind: 0,
      Left: { Column: { Expression: { SourceRef: { Source: 'f' } }, Property: prop } },
      Right: { Literal: { Value: 'null' } },
    } } } } }] },
    howCreated: 'User',
  }] };
}

function chart(type, x, y, w, h, title, { cat, y: yf, series } = {}, sortMeasure = null, opts = {}) {
  const qs = {};
  if (cat) qs.Category = { projections: [cat] };
  if (yf) qs.Y = { projections: Array.isArray(yf) ? yf : [yf] };
  if (series) qs.Series = { projections: [series] };
  const query = { queryState: qs };
  if (sortMeasure) query.sortDefinition = { sort: [{ field: meas(sortMeasure).field, direction: 'Descending' }], isDefaultSort: true };
  const objects = {};
  if (opts.legend) objects.legend = [{ properties: { show: bool(true), position: str('Bottom') } }];
  if (opts.labels === false) objects.labels = [{ properties: { show: bool(false) } }];
  else if (opts.labels === true) objects.labels = [{ properties: { show: bool(true) } }];
  const node = {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: type,
      query,
      ...(Object.keys(objects).length ? { objects } : {}),
      visualContainerObjects: {
        title: [{ properties: { show: bool(true), text: str(title), fontColor: solid(C.heading), alignment: str('left') } }],
        subTitle: [{ properties: { show: bool(false) } }],
        general: [{ properties: { altText: str(`${title}. ${opts.alt || 'Bar chart.'}`) } }],
      },
    },
  };
  if (opts.notBlank) node.filterConfig = notBlankFilter(opts.notBlank.entity, opts.notBlank.prop);
  return node;
}

function table(x, y, w, h, title, fields) {
  return {
    $schema: V, name: id(), position: pos(x, y, w, h),
    visual: {
      visualType: 'tableEx',
      query: { queryState: { Values: { projections: fields } } },
      objects: {
        columnHeaders: [{ properties: { columnAdjustment: str('growToFit'), autoSizeColumnWidth: bool(true), fontColor: solid(C.headerText), backColor: solid(C.navy) } }],
        total: [{ properties: { totals: bool(false) } }],
      },
      visualContainerObjects: {
        stylePreset: [{ properties: { name: str('None') } }],
        title: [{ properties: { show: bool(true), text: str(title), fontColor: solid(C.heading), alignment: str('left') } }],
        general: [{ properties: { altText: str(`${title} (table).`) } }],
      },
    },
  };
}

// ---- framework assembler for a standard (visible) page ----
function framework(title, subtitle, { nav = true } = {}) {
  const v = [];
  v.push(shapeRect(0, 0, 1920, 56, C.card));              // brand bar
  v.push(shapeRect(0, 55, 1920, 1, C.border));            // bottom rule
  v.push(shapeRect(0, 56, 1920, 96, C.navy));             // title band
  v.push(logo(24, 10, 160, 36));
  if (nav) {
    v.push(pageNavigator(700, 10, 1060, 36));
    v.push(button(1800, 12, 36, 32, 'i', { type: str('PageNavigation'), navigationSection: str(PAGE_ABOUT) }, { fontColor: C.heading }));
  }
  v.push(textbox(32, 60, 1000, 44, title, { size: '26px', color: C.headerText, bold: true }));
  v.push(textbox(32, 110, 1100, 22, subtitle, { size: '12px', color: C.subtitle, bold: false }));
  return v;
}

function globalSlicers() {
  return [
    slicer(1172, 70, 196, 76, 'DIM_DISTRICT', 'DISTRICT_NAME', 'District'),
    slicer(1380, 70, 196, 76, 'DIM_VENDOR', 'VENDOR_NAME', 'Vendor'),
    slicer(1588, 70, 188, 76, 'DIM_DATE_CERTAINTY', 'DATE_CERTAINTY', 'Date certainty'),
    button(1788, 90, 100, 40, 'Reset', { type: str('ClearAllSlicers'), tooltip: str('Clear all slicers') }),
  ];
}

// Stable page ids — set to the ids Power BI Desktop currently holds, so a live
// reload applies content edits to the existing pages without a reopen.
const PAGE_ABOUT = 'abouteb1e7a650ca0176f';

function writePage(name, displayName, visuals, { hidden = false, drillColumn = null } = {}) {
  const dir = path.join(PAGES_DIR, name, 'visuals');
  fs.mkdirSync(dir, { recursive: true });
  const page = { $schema: PAGE_SCHEMA, name, displayName, displayOption: 'FitToPage', height: 1080, width: 1920,
    objects: { background: [{ properties: { color: solid(C.page), transparency: num(0) } }] } };
  if (hidden) page.visibility = 'HiddenInViewMode';
  if (drillColumn) {
    const fname = 'Filter' + crypto.randomBytes(12).toString('hex');
    const fieldExpr = { Column: { Expression: { SourceRef: { Entity: drillColumn.entity } }, Property: drillColumn.prop } };
    page.filterConfig = { filters: [{ name: fname, field: fieldExpr, type: 'Categorical', howCreated: 'Drillthrough' }] };
    page.pageBinding = { name: 'Pod', type: 'Drillthrough', parameters: [{ name: 'Param_' + fname, boundFilter: fname, fieldExpr }] };
  }
  fs.writeFileSync(path.join(PAGES_DIR, name, 'page.json'), JSON.stringify(page, null, 2));
  for (const vis of visuals) {
    const vdir = path.join(dir, vis.name);
    fs.mkdirSync(vdir, { recursive: true });
    fs.writeFileSync(path.join(vdir, 'visual.json'), JSON.stringify(vis, null, 2));
  }
}

// ---- wipe existing pages ----
for (const d of fs.readdirSync(PAGES_DIR)) {
  const p = path.join(PAGES_DIR, d);
  if (fs.statSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true });
}

const pOverview = 'pd09c552442b569ac62';
const pClearing = 'pba49587702f66f60ed';
const pVendors = 'pc452737b9e037ee36d';
const pQuality = 'p2765544ba3b1e69dc3';
const pFeeder = 'pef473532f0859c3867';

// === Page 1: Plan Overview ===
{
  const v = [...framework('PLAN OVERVIEW', 'Clearing plan snapshot · use the slicers to filter'), ...globalSlicers()];
  v.push(card(32, 164, 1856, 104, ['Feeders in Plan', 'Line Miles in Plan', '% Plan Date Confirmed', 'Feeders Overdue']));
  v.push(chart('columnChart', 32, 284, 1070, 764, 'Next clearings by month, by certainty',
    { cat: col('DIM_DATE', 'Month Year'), y: meas('Feeders in Plan'), series: col('DIM_DATE_CERTAINTY', 'DATE_CERTAINTY') },
    null, { legend: true, labels: false, notBlank: { entity: 'FACT_ROW_PLAN', prop: 'NEXT_CLEARING_DATE' } }));
  v.push(chart('barChart', 1126, 284, 762, 764, 'Feeders by district',
    { cat: col('DIM_DISTRICT', 'DISTRICT_NAME'), y: meas('Feeders in Plan') }, 'Feeders in Plan'));
  writePage(pOverview, 'Plan Overview', v);
}

// === Page 2: Clearing Plan ===
{
  const v = [...framework('CLEARING PLAN', 'Overdue and due-soon feeders · status flagged per feeder'), ...globalSlicers()];
  v.push(card(32, 164, 1856, 104, ['Feeders Overdue', 'Line Miles Overdue', 'Feeders Due Soon']));
  v.push(textbox(32, 288, 900, 24, 'Clearing status per feeder (Overdue / Due soon / Scheduled / No date)', { size: '12px', color: C.textPrimary, bold: false }));
  v.push(button(1740, 284, 148, 36, 'Feeder details', { type: str('Drillthrough'), drillthroughSection: str(pFeeder) }, { fill: C.navy }));
  v.push(table(32, 332, 1856, 716, 'Feeders in the clearing plan', [
    col('DIM_CIRCUIT', 'FEEDER_ID'), col('DIM_CIRCUIT', 'CIRCUIT_NAME'), col('DIM_DISTRICT', 'DISTRICT_NAME'),
    col('DIM_VENDOR', 'VENDOR_NAME'), col('FACT_ROW_PLAN', 'LAST_CLEARED_DATE'), col('FACT_ROW_PLAN', 'NEXT_CLEARING_DATE'),
    col('DIM_DATE_CERTAINTY', 'DATE_CERTAINTY'), meas('Clearing Status'), col('FACT_ROW_PLAN', 'NOTES'),
  ]));
  writePage(pClearing, 'Clearing Plan', v);
}

// === Page 3: Vendors and Districts ===
{
  const v = [...framework('VENDORS AND DISTRICTS', 'Workload by vendor, vendor type and district'), ...globalSlicers()];
  v.push(card(32, 164, 1856, 104, ['Line Miles in Plan', 'Feeders in Plan', 'Line Miles Overdue']));
  v.push(chart('barChart', 32, 284, 916, 370, 'Line miles by vendor',
    { cat: col('DIM_VENDOR', 'VENDOR_NAME'), y: meas('Line Miles by Vendor') }, 'Line Miles by Vendor'));
  v.push(chart('barChart', 972, 284, 916, 370, 'Feeders by vendor type',
    { cat: col('DIM_VENDOR', 'VENDOR_TYPE'), y: meas('Feeders in Plan') }, 'Feeders in Plan'));
  v.push(chart('barChart', 32, 678, 916, 370, 'Line miles by district',
    { cat: col('DIM_DISTRICT', 'DISTRICT_NAME'), y: meas('Line Miles in Plan') }, 'Line Miles in Plan'));
  v.push(chart('hundredPercentStackedBarChart', 972, 678, 916, 370, 'District plan firmness by certainty',
    { cat: col('DIM_DISTRICT', 'DISTRICT_NAME'), y: meas('Feeders in Plan'), series: col('DIM_DATE_CERTAINTY', 'DATE_CERTAINTY') }));
  writePage(pVendors, 'Vendors and Districts', v);
}

// === Page 4: Data Quality ===
{
  const v = [...framework('DATA QUALITY', 'Source-spreadsheet problems caught and cleaned'), ...globalSlicers()];
  v.push(card(32, 164, 1856, 104, ['DQ Issues', 'Feeders with DQ Issues', '% Feeders with DQ Issues', 'Orphans to Review']));
  v.push(chart('barChart', 32, 284, 916, 360, 'Issues by type',
    { cat: col('FACT_DQ_ISSUE', 'ISSUE_TYPE'), y: meas('DQ Issues') }, 'DQ Issues'));
  v.push(chart('barChart', 972, 284, 916, 360, 'Issues by source column',
    { cat: col('FACT_DQ_ISSUE', 'SOURCE_COLUMN'), y: meas('DQ Issues') }, 'DQ Issues'));
  v.push(table(32, 668, 1856, 380, 'Raw vs clean values', [
    col('FACT_DQ_ISSUE', 'FEEDER_ID'), col('FACT_DQ_ISSUE', 'ISSUE_TYPE'), col('FACT_DQ_ISSUE', 'SOURCE_COLUMN'),
    col('FACT_DQ_ISSUE', 'RAW_VALUE'), col('FACT_DQ_ISSUE', 'CLEAN_VALUE'),
  ]));
  writePage(pQuality, 'Data Quality', v);
}

// === Page 5: Feeder Detail (hidden drillthrough) ===
{
  const v = [];
  v.push(shapeRect(0, 0, 1920, 56, C.card));
  v.push(shapeRect(0, 55, 1920, 1, C.border));
  v.push(shapeRect(0, 56, 1920, 96, C.navy));
  v.push(logo(24, 10, 160, 36));
  v.push(button(204, 12, 90, 32, 'Back', { type: str('Back') }, { fontColor: C.heading }));
  v.push(textbox(32, 60, 1000, 44, 'FEEDER DETAIL', { size: '26px', color: C.headerText, bold: true }));
  v.push(textbox(32, 110, 1100, 22, 'Circuit, plan, work history and data-quality issues for the selected feeder', { size: '12px', color: C.subtitle, bold: false }));
  v.push(card(32, 164, 1856, 104, ['Line Miles in Plan', 'Avg Years Since Last Clearing', 'DQ Issues']));
  v.push(table(32, 284, 916, 764, 'Feeder details', [
    col('DIM_CIRCUIT', 'CIRCUIT_NAME'), col('DIM_CIRCUIT', 'SUBSTATION_NAME'), col('DIM_DISTRICT', 'DISTRICT_NAME'),
    col('DIM_VENDOR', 'VENDOR_NAME'), col('FACT_ROW_PLAN', 'PLANNED_YEAR'), col('FACT_ROW_PLAN', 'LAST_CLEARED_DATE'),
    col('FACT_ROW_PLAN', 'NEXT_CLEARING_DATE'), col('DIM_DATE_CERTAINTY', 'DATE_CERTAINTY'),
    col('FACT_ROW_PLAN', 'LAST_WORK_DONE'), col('FACT_ROW_PLAN', 'NOTES'),
  ]));
  v.push(table(972, 284, 916, 764, 'Data-quality issues on this feeder', [
    col('FACT_DQ_ISSUE', 'ISSUE_TYPE'), col('FACT_DQ_ISSUE', 'SOURCE_COLUMN'),
    col('FACT_DQ_ISSUE', 'RAW_VALUE'), col('FACT_DQ_ISSUE', 'CLEAN_VALUE'),
  ]));
  writePage(pFeeder, 'Feeder Detail', v, { hidden: true, drillColumn: { entity: 'DIM_CIRCUIT', prop: 'FEEDER_ID' } });
}

// === Page 6: About (hidden) ===
{
  const v = [];
  v.push(shapeRect(0, 0, 1920, 56, C.card));
  v.push(shapeRect(0, 55, 1920, 1, C.border));
  v.push(shapeRect(0, 56, 1920, 96, C.navy));
  v.push(logo(24, 10, 160, 36));
  v.push(button(204, 12, 90, 32, 'Back', { type: str('Back') }, { fontColor: C.heading }));
  v.push(textbox(32, 60, 1000, 44, 'ABOUT THIS REPORT', { size: '26px', color: C.headerText, bold: true }));
  const about = [
    'ROW Clearing Plan — right-of-way (vegetation) clearing tracker (synthetic data).',
    '',
    'Audience: vegetation management lead, district managers, operations leadership.',
    'Purpose: which feeders are overdue or due soon and who owns them; how firm the plan is; where the source spreadsheet was unreliable.',
    '',
    'Measures (see docs/measures.md):',
    '• Feeders in Plan — distinct feeders with a plan row.',
    '• Line Miles in Plan — line miles of plan feeders, each counted once.',
    '• % Plan Date Confirmed — confirmed-certainty feeders ÷ Feeders in Plan.',
    '• Feeders Next Year / Feeders TBD — feeders by those certainties.',
    '• Feeders Overdue — confirmed/tentative feeders with a next date before today.',
    '• Line Miles Overdue — line miles on overdue feeders.',
    '• Feeders Due Soon — next date within 90 days.',
    '• Avg Years Since Last Clearing — mean years since last cleared (blanks excluded).',
    '• Feeders Not Cleared 5+ Years — last cleared more than 5 years ago.',
    '• Line Miles by Vendor — line miles in plan, split by vendor.',
    '• DQ Issues — data-quality problems caught (69, incl. 2 orphans).',
    '• Feeders with DQ Issues / % Feeders with DQ Issues — affected in-plan feeders.',
    '• Orphans to Review — spreadsheet feeders with no matching circuit (2).',
    '',
    '“Today” is TODAY(). Data source: Snowflake ROW_DB.ANALYTICS (Import). Refresh: manual (static synthetic data for the POC).',
    'Contact: BI team. Standards: brillit-report-standards v0.2.',
  ];
  const runs = about.map((line) => ({ textRuns: [{ value: line, textStyle: { fontFamily: 'Arial', fontSize: '13px', color: C.textPrimary } }], horizontalTextAlignment: 'left' }));
  v.push({ $schema: V, name: id(), position: pos(32, 176, 1500, 860),
    visual: { visualType: 'textbox', objects: { general: [{ properties: { paragraphs: runs } }] },
      visualContainerObjects: { background: [{ properties: { show: bool(true), color: solid(C.card), transparency: num(0) } }], border: [{ properties: { show: bool(true), color: solid(C.border) } }],
        padding: [{ properties: { top: num(16), bottom: num(16), left: num(20), right: num(20) } }] } } });
  writePage(PAGE_ABOUT, 'About', v, { hidden: true });
}

// ---- pages.json ----
const order = [pOverview, pClearing, pVendors, pQuality, pFeeder, PAGE_ABOUT];
fs.writeFileSync(path.join(PAGES_DIR, 'pages.json'), JSON.stringify({
  $schema: 'https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.1.0/schema.json',
  pageOrder: order, activePageName: pOverview,
}, null, 2));

console.log('Wrote pages:', order.join(', '));
