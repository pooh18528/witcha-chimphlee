import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse all dusit.ac.th links from the text file
function parseLinks() {
  const text = readFileSync(__dirname + '/../รองศาสตราจารย์ ดร.วิชชา ฉิมพลี.txt', 'utf-8');
  const lines = text.split('\n');
  const links = [];
  let currentYear = null;
  for (const line of lines) {
    const yearMatch = line.match(/^(\d{4})$/);
    if (yearMatch) {
      currentYear = yearMatch[1];
      continue;
    }
    const urlMatch = line.match(/https:\/\/www\.dusit\.ac\.th\/home\/\d{4}\/\d+\.html/);
    if (urlMatch && currentYear) {
      links.push({ year: currentYear, url: urlMatch[0] });
    }
  }
  return links;
}

function extractGalleryInfo(html, url) {
  const result = {
    hasNextGen: false,
    nextGenFolders: [],
    nextGenImageCount: 0,
    hasWpGallery: false,
    wpImageIds: [],
    allImgSrcs: [],
    imgCount: 0,
  };

  // Count <img> tags
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = imgRegex.exec(html)) !== null) {
    result.allImgSrcs.push(m[1]);
    result.imgCount++;
  }

  // NextGen Gallery detection
  if (html.includes('ngg-galleryoverview') || html.includes('ngg-gallery-thumbnail') || html.includes('/home/wp-content/gallery/')) {
    result.hasNextGen = true;
    // Extract gallery folder names
    const folderRegex = /\/home\/wp-content\/gallery\/([^"\/]+)/g;
    let fm;
    while ((fm = folderRegex.exec(html)) !== null) {
      if (!result.nextGenFolders.includes(fm[1])) {
        result.nextGenFolders.push(fm[1]);
      }
    }
    // Count ngg-gallery-thumbnail-box items
    const thumbBoxMatches = html.match(/ngg-gallery-thumbnail-box/g);
    if (thumbBoxMatches) {
      result.nextGenImageCount = thumbBoxMatches.length;
    }
    // Also count ngg-gallery-thumbnail elements
    const thumbMatches = html.match(/ngg-gallery-thumbnail[^-]/g);
    if (!result.nextGenImageCount && thumbMatches) {
      result.nextGenImageCount = thumbMatches.length;
    }
  }

  // WordPress gallery detection
  const wpImageRegex = /wp-image-(\d+)/g;
  let wm;
  while ((wm = wpImageRegex.exec(html)) !== null) {
    result.wpImageIds.push(wm[1]);
  }
  if (result.wpImageIds.length > 0) {
    result.hasWpGallery = true;
  }

  return result;
}

async function main() {
  const links = parseLinks();
  console.log(`Found ${links.length} dusit.ac.th links\n`);

  const results = [];
  const outDir = __dirname + '/../gallery_results';
  if (!existsSync(outDir)) mkdirSync(outDir);

  const concurrency = 5;
  for (let i = 0; i < links.length; i += concurrency) {
    const batch = links.slice(i, i + concurrency);
    const promises = batch.map(async (link) => {
      try {
        const resp = await fetch(link.url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GalleryChecker/1.0)' }
        });
        const html = await resp.text();
        const info = extractGalleryInfo(html, link.url);
        return { ...link, success: true, ...info };
      } catch (err) {
        return { ...link, success: false, error: err.message };
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    // Print progress
    const done = Math.min(i + concurrency, links.length);
    process.stdout.write(`\rProgress: ${done}/${links.length}`);
  }

  process.stdout.write('\n\n');

  // Write detailed results
  const reportLines = [];
  reportLines.push('============================================');
  reportLines.push('Gallery Check Results for dusit.ac.th pages');
  reportLines.push('============================================\n');

  for (const r of results) {
    reportLines.push(`--- ${r.url} ---`);
    reportLines.push(`Year: ${r.year}`);
    if (!r.success) {
      reportLines.push(`Status: ERROR - ${r.error}`);
      reportLines.push('');
      continue;
    }
    reportLines.push(`Status: OK - ${r.imgCount} img tags found`);

    if (r.hasNextGen) {
      reportLines.push(`NextGen Gallery: YES`);
      reportLines.push(`  Folder(s): ${r.nextGenFolders.join(', ') || '(unknown)'}`);
      reportLines.push(`  Image count (from thumbnails): ${r.nextGenImageCount}`);
    } else {
      reportLines.push(`NextGen Gallery: NO`);
    }

    if (r.hasWpGallery) {
      reportLines.push(`WordPress Gallery: YES (${r.wpImageIds.length} images)`);
    } else {
      reportLines.push(`WordPress Gallery: NO`);
    }

    if (r.imgCount > 0 && !r.hasNextGen && !r.hasWpGallery) {
      reportLines.push(`Other <img> srcs:`);
      for (const src of r.allImgSrcs) {
        // Only show plausible photo URLs (not icons, logos, etc.)
        if (!src.includes('icon') && !src.includes('logo') && !src.includes('avatar') && !src.includes('spacer') && !src.includes('pixel')) {
          reportLines.push(`  ${src}`);
        }
      }
    }
    reportLines.push('');
  }

  // Summary
  reportLines.push('============================================');
  reportLines.push('Summary');
  reportLines.push('============================================\n');
  
  let successCount = 0;
  let nextGenCount = 0;
  let wpCount = 0;
  let noGalleryCount = 0;
  let errorCount = 0;
  let totalImages = 0;

  for (const r of results) {
    if (!r.success) { errorCount++; continue; }
    successCount++;
    totalImages += r.imgCount || 0;
    if (r.hasNextGen) nextGenCount++;
    if (r.hasWpGallery) wpCount++;
    if (!r.hasNextGen && !r.hasWpGallery) noGalleryCount++;
  }

  reportLines.push(`Total pages: ${results.length}`);
  reportLines.push(`Successfully fetched: ${successCount}`);
  reportLines.push(`Errors: ${errorCount}`);
  reportLines.push(`Pages with NextGen Gallery: ${nextGenCount}`);
  reportLines.push(`Pages with WordPress Gallery: ${wpCount}`);
  reportLines.push(`Pages with no gallery detected: ${noGalleryCount}`);
  reportLines.push(`Total <img> tags across all pages: ${totalImages}`);

  const report = reportLines.join('\n');
  writeFileSync(`${outDir}/report.txt`, report, 'utf-8');
  console.log(report);
  console.log(`\nFull report saved to: ${outDir}/report.txt`);

  // Also save JSON for programmatic use
  writeFileSync(`${outDir}/results.json`, JSON.stringify(results, null, 2), 'utf-8');
}

main().catch(console.error);
