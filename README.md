# Gladiatus Bot

Chrome Manifest V3 eklentisi. Derleme ve bağımlılık kurulumu gerektirmez.

## Kurulum

Chrome'da `chrome://extensions` sayfasını aç. **Geliştirici modu** seçeneğini etkinleştir. **Paketlenmemiş öğe yükle** ile bu proje klasörünü seç.

Gladiatus sekmesini yenile, eklenti simgesine tıkla ve **Başlat** düğmesine bas. **Sayfayı oku** güncel sayfa bilgisini ve günlüğü gösterir. **Durdur** kontrol döngüsünü kapatır.

## Otomatik keşif

Keşif bölgesini aç, eklenti panelinden sayfadaki normal saldırı sırasına göre rakibi seç ve başlat. Keşif puanı pozitifse ve bekleme göstergesi hazırsa normal saldırı düğmesini tıklar. Premium saldırılar seçime dahil edilmez. Savaş raporundan seçilen bölgeye döner; aynı sekmedeki yenilemelerde devam eder. Durdur düğmesi döngüyü kapatır. Sekmeyi kapatmak oturumu sonlandırır.

Puan veya bekleme göstergesi okunamazsa saldırmaz. Sonuç belirsizse ikinci saldırıyı engeller; günlüğü kontrol et. DOM seçicileri gerçek hesapta henüz doğrulanmadı. Günlük son 50 kaydı tutar; arka plan sekmelerinde Chrome zamanlayıcıları gecikebilir. Otomasyonu tek oyun sekmesinde çalıştır.

`content.js` oyun okuma ve görev döngüsünü, `popup.js` kontrol panelini içerir.

## Otomatik zindan

İstediğin zindanın sayfasını aç, eklentiden Normal veya İleri zorluğu seç ve **Zindanı başlat** düğmesine bas. Aktif bir zindan varsa mevcut savaşı sürdürür; seçilen zorluk sonraki girişte uygulanır. Puan pozitif ve bekleme bitmişse haritadaki sıradaki savaş noktasını tıklar. Rapor sonrası seçilen zindana döner; giriş ekranına ulaştığında aynı zorlukta yeniden girer. Giriş veya saldırı sonucu belirsizse tekrar tıklamaz. **Zindanı durdur** yalnızca zindanı durdurur; keşif ayrı kontrol edilir. İkisi açıkken bir kontrolde tek işlem yapılır; hazır zindana öncelik verilir.

Zindan seçicileri gerçek hesapta henüz test edilmedi. Göstergeler veya düğmeler bulunamazsa günlükte belirtilir. Testler: `node --test tests/*.test.cjs`.

## Keşif ve zindan birlikte

Keşif sayfasında rakibi seçip **Keşfi kaydet** düğmesine bas. Aynı sekmede istediğin zindanı aç, zorluğu seçip **Zindanı kaydet** düğmesine bas. **İkisini başlat** iki görevi tek döngüde çalıştırır. Saldırılar Keşif → Zindan şeklinde dönüşümlüdür; puanı olmayan veya bekleyen görev yerine hazır olan görev çalışır. Yönlendirme ve zindana giriş sırayı değiştirmez. Sıra sayfa yenilenince korunur. **Tümünü durdur** iki görevi durdurur, seçimleri korur.

Kod değişikliğinden sonra eklentiler sayfasındaki **Yeniden yükle** düğmesine bas ve oyun sekmesini yenile.

Chrome içerik betikleri: https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
