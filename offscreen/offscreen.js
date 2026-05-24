(function () {
  "use strict";

  const FOLDER_MAP = {
    video: "Videos", audio: "Audio", image: "Images",
    icon: "Icons", document: "Documents", link: "Links", other: "Other"
  };

  const CONCURRENCY_LIMIT = 10;
  const encoder = new TextEncoder();

  // --- PRE-COMPUTED CRC TABLE (Major Speed Boost) ---
  const CRC_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c;
  }

  function fastCrc32(data) {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "mct-zip-port") {
      port.onMessage.addListener(async (msg) => {
        if (msg.action === "createZip") {
          try {
            const result = await createTurboManualZip(msg.items);
            port.postMessage({ action: "zipCreated", ...result });
          } catch (error) {
            port.postMessage({ action: "error", message: error.message });
          }
        } else if (msg.action === "cleanup") {
          if (msg.objectUrl && msg.objectUrl.startsWith("blob:")) {
            URL.revokeObjectURL(msg.objectUrl);
          }
        }
      });
    }
  });

  async function createTurboManualZip(items) {
    const zipParts = [];
    const centralDirectoryParts = [];
    let currentOffset = 0;
    let packagedCount = 0;

      // Process in batches
      for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
        const batch = items.slice(i, i + CONCURRENCY_LIMIT);
        
        const results = await Promise.all(
          batch.map(async (item, index) => {
            try {
              const response = await fetch(item.url, { credentials: "include" });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const fileData = new Uint8Array(await response.arrayBuffer());
              
              const folderName = FOLDER_MAP[item.category || "other"] || "Other";
              const uniqueId = i + index;
              const baseFileName = (item.filename || `file_${uniqueId}`).replace(/[^\w.-]/g, "_");
              const fullPath = `${folderName}/${baseFileName}`;
              const pathBytes = encoder.encode(fullPath);
              
              // Calculate everything for this file in parallel
              const crc = fastCrc32(fileData);
              const timestamp = dosDateTime();

              // Prepare Local Header
              const lfh = new Uint8Array(30 + pathBytes.length);
              const lfhDV = new DataView(lfh.buffer);
              lfhDV.setUint32(0, 0x04034b50, true);
              lfhDV.setUint16(4, 20, true);
              lfhDV.setUint16(6, 0, true);
              lfhDV.setUint16(8, 0, true);
              lfhDV.setUint32(10, timestamp, true);
              lfhDV.setUint32(14, crc, true);
              lfhDV.setUint32(18, fileData.length, true);
              lfhDV.setUint32(22, fileData.length, true);
              lfhDV.setUint16(26, pathBytes.length, true);
              lfh.set(pathBytes, 30);

              // Prepare Central Directory Header
              const cdh = new Uint8Array(46 + pathBytes.length);
              const cdhDV = new DataView(cdh.buffer);
              cdhDV.setUint32(0, 0x02014b50, true);
              cdhDV.setUint16(4, 20, true);
              cdhDV.setUint16(6, 20, true);
              cdhDV.setUint32(12, timestamp, true);
              cdhDV.setUint32(16, crc, true);
              cdhDV.setUint32(20, fileData.length, true);
              cdhDV.setUint32(24, fileData.length, true);
              cdhDV.setUint16(28, pathBytes.length, true);
              // Offset will be set in the sequential phase

              return { success: true, lfh, fileData, cdh, pathBytesLength: pathBytes.length };
            } catch (e) {
              console.error(`[MCT] Turbo Error:`, e);
              return { success: false };
            }
          })
        );

        // Finalize the batch sequentially (Offsets MUST be sequential)
        for (const res of results) {
          if (!res.success) continue;
          
          const { lfh, fileData, cdh } = res;
          const cdhDV = new DataView(cdh.buffer);
          cdhDV.setUint32(42, currentOffset, true); // Set the actual offset

          zipParts.push(lfh, fileData);
          centralDirectoryParts.push(cdh);
          
          currentOffset += lfh.length + fileData.length;
          packagedCount++;
        }

        // Report progress back to background/popup
        const percent = Math.round(((i + batch.length) / items.length) * 100);
        port.postMessage({ action: "progress", percent });
      }

    if (packagedCount === 0) throw new Error("Packaging failed: No files reachable.");

    const cdBlob = new Blob(centralDirectoryParts);
    const eocd = new Uint8Array(22);
    const eocdDV = new DataView(eocd.buffer);
    eocdDV.setUint32(0, 0x06054b50, true);
    eocdDV.setUint16(8, packagedCount, true);
    eocdDV.setUint16(10, packagedCount, true);
    eocdDV.setUint32(12, cdBlob.size, true);
    eocdDV.setUint32(16, currentOffset, true);

    const finalBlob = new Blob([...zipParts, cdBlob, eocd], { type: "application/zip" });
    
    return {
      objectUrl: URL.createObjectURL(finalBlob),
      packagedCount,
      total: items.length,
      isBlob: true
    };
  }

  function dosDateTime() {
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    return (date << 16) | time;
  }
})();
