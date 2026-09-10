public String judges(){
String AppPath=AppPath+"";
   if(AppPath.equals("void"))
   {
      return "Serendipity";
   }
   else
   {
      return "QStory";
   }
}
String New_Bnben="3.4.0";
int New_Xiaobanben=340;
String New_Log="🔥🌲更新";
String New_Download="https://gitee.com/Myn_1/Mao_Yuna/raw/MYN_update/Music/羽雫3.4.0.zip";
if (New_Xiaobanben > 小版本) {
Activity act = getNowActivity();
if (act != null) {
Toast("羽雫の点歌有新版本!");
act.runOnUiThread(new Runnable() {
public void run() {
new AlertDialog.Builder(act, AlertDialog.THEME_DEVICE_DEFAULT_LIGHT)
.setTitle("V" + New_Bnben + "版本更新")
.setMessage("羽雫の点歌java有更新!\n当前版本:" + 版本 + "(" + 小版本 + ")\n最新版本:" + New_Bnben + "(" + New_Xiaobanben + ")\n---\n更新日志:\n" + New_Log + "\n---\n下载链接:" + New_Download)
.setNegativeButton("不更新", null)
.setPositiveButton("更新", new DialogInterface.OnClickListener() {
public void onClick(DialogInterface dialog, int which) {
ts3("开始更新...");
new Thread(new Runnable() {
public void run() {
if(judges().equals("Serendipity")){
download(New_Download, "/storage/emulated/0/Android/data/com.tencent.mobileqq/Serendipity/plugin/羽雫" + New_Bnben + ".zip");
Unzip("/storage/emulated/0/Android/data/com.tencent.mobileqq/Serendipity/plugin/羽雫" + New_Bnben + ".zip", "/storage/emulated/0/Android/data/com.tencent.mobileqq/Serendipity/plugin/");
ts("点歌更新完成","更新完成,已经自动解压到"+judges()+"脚本目录,加载新版本即可");
 OK=false;
File f1 = new File("/storage/emulated/0/Android/data/com.tencent.mobileqq/Serendipity/plugin/羽雫" + New_Bnben + ".zip");
f1.delete();
}else{
download(New_Download, "/storage/emulated/0/Android/data/com.tencent.mobileqq/QStory/Plugin/羽雫" + New_Bnben + ".zip");
Unzip("/storage/emulated/0/Android/data/com.tencent.mobileqq/QStory/Plugin/羽雫" + New_Bnben + ".zip", "/storage/emulated/0/Android/data/com.tencent.mobileqq/QStory/Plugin/");
ts("点歌更新完成","更新完成,已经自动解压到"+judges()+"脚本目录,加载新版本即可");
 OK=false;
File f1 = new File("/storage/emulated/0/Android/data/com.tencent.mobileqq/QStory/Plugin/羽雫" + New_Bnben + ".zip");
f1.delete();
}
}
}).start();
}
})
.setCancelable(false)
.show();
}
});
} else {
// Activity 为 null，无法显示对话框
}
} else /*if (New_Xiaobanben < 小版本)*/ {
//Toast("不是，你版本是不是有点高");
File d=new File(猫羽雫+"随机一言.txt");
String yiyan=取文件(d);
long endTime = System.currentTimeMillis();
Toast("加载消耗"+(endTime-startTime)/1000.0+"秒\n当前模块:"+judges()+"\n一言:\n"+yiyan+"\n-------end");
}
