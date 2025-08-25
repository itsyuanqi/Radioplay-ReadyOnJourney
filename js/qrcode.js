const canvas = document.getElementById('qrcode');
const wifiDisplay = document.getElementById('currentWifi');

function updateQR() {
    fetch('url.txt')
        .then(res => res.text())
        .then(text => {
            const lines = text.trim().split('\n');
            const url = lines[0] || '';
            const wifi = lines[1] || '';

            // 生成二维码
            QRCode.toCanvas(canvas, url, { width: 200 }, function (error) {
                if (error) console.error(error);
            });

            // 更新 Wi-Fi 名称显示
            wifiDisplay.textContent = wifi;
        })
        .catch(err => console.error('Failed to load URL:', err));
}

updateQR();
setInterval(updateQR, 5000);