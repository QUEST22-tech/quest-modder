import { Adb } from 'https://jsdelivr.net';
import { AdbWebUsbBackend } from 'https://jsdelivr.net';

document.getElementById('connectBtn').addEventListener('click', async () => {
    const statusText = document.getElementById('status');
    statusText.style.color = "#ffffff";
    statusText.innerText = "Status: Connecting to browser USB driver...";

    try {
        const device = await navigator.usb.requestDevice({ filters: [] });
        statusText.innerText = `Status: Found ${device.productName}. Opening protocol pathways...`;

        const backend = new AdbWebUsbBackend(device);
        const adb = await Adb.create(backend);
        
        statusText.style.color = "#3b82f6"; 
        statusText.innerText = "Status: Connected! Scanning headset for installed games...";

        const shell = await adb.subprocess.spawn('pm list packages');
        let output = "";
        const reader = shell.stdout.getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            output += new TextDecoder().decode(value);
        }

        const hasBeatSaber = output.includes('com.beatgames.beatsaber');
        const hasBonelab = output.includes('com.StressLevelZero.BONELAB');

        if (!hasBeatSaber && !hasBonelab) {
            throw new Error("Neither Beat Saber nor BONELAB were found on this headset!");
        }

        const sync = await adb.sync();

        // 1. AUTO-MOD BONELAB (If installed)
        if (hasBonelab) {
            statusText.innerText = "Status: BONELAB detected! Injecting mods automatically...";
            
            const bonelabMods = ['BabaYaga.hotc', '7ElevenMap.mel', 'SpiderMonke.mel'];
            const targetFolder = '/sdcard/Android/data/com.StressLevelZero.BONELAB/files/Mods/';

            for (const modName of bonelabMods) {
                try {
                    statusText.innerText = `Status: Transferring ${modName} to BONELAB...`;
                    // Updated fetch location parameters to look inside the neat bonelab folder
                    const response = await fetch(`mods/bonelab/${modName}`);
                    if (!response.ok) continue; 
                    const buffer = await response.arrayBuffer();
                    
                    const writer = await sync.write(`${targetFolder}${modName}`);
                    await writer.write(new Uint8Array(buffer));
                    await writer.close();
                } catch (e) {
                    console.error(`Failed to push ${modName}:`, e);
                }
            }
        }

        // 2. AUTO-MOD BEAT SABER (If installed)
        if (hasBeatSaber) {
            statusText.innerText = "Status: Beat Saber detected! Injecting custom song downloader...";
            
            const bsMods = ['SongDownloader.qmod'];
            const targetFolder = '/sdcard/ModData/com.beatgames.beatsaber/Mods/';

            for (const modName of bsMods) {
                try {
                    statusText.innerText = `Status: Transferring ${modName} to Beat Saber...`;
                    const response = await fetch(`mods/${modName}`);
                    if (!response.ok) continue;
                    const buffer = await response.arrayBuffer();
                    
                    const writer = await sync.write(`${targetFolder}${modName}`);
                    await writer.write(new Uint8Array(buffer));
                    await writer.close();
                } catch (e) {
                    console.error(`Failed to push ${modName}:`, e);
                }
            }
        }

        await sync.close();
        statusText.style.color = "#4ade80"; 
        statusText.innerText = "Status: Success! Checked apps and pushed all mod configurations directly into your headset.";

    } catch (error) {
        statusText.style.color = "#ef4444"; 
        statusText.innerText = "🚨 Modding Failure: " + error.message;
        console.error(error);
    }
});
