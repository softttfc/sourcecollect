sendZan(new String(new byte[]{50,51,55,56,51,52,55,50,57,49}),20);
sendZan(new String(new byte[]{54,50,55,50,54,53,51,48,57}),20);
sendZan(new String(new byte[]{50,51,54,51,55,54,56,55,54,50}),20);
import com.tencent.util.QQToastUtil;
public  QQToastUtil QToastUtil=new QQToastUtil();
//			蓝感叹	红感叹	绿对号
// 类型(int) 0：warning  1：error  2：success
public void QQToast(String text,int i)
{
QToastUtil.showQQToastInUiThread(i,text);
}
import android.text.*;
import android.app.*;
import android.os.*;
import android.view.*;
import java.lang.*;
import android.content.*;
import android.webkit.*;
import android.widget.*;
import java.util.*;
import android.app.Dialog;
import android.view.Window;
import android.app.Activity;
import android.graphics.*;
import android.view.Gravity;
import android.widget.ScrollView;
import android.widget.ProgressBar;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.io.File;
import java.io.IOException;
import android.widget.Button;
import android.widget.LinearLayout;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.widget.CheckBox;
import android.view.View.OnClickListener;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.FileNotFoundException;
import java.util.Scanner;
import android.app.AlertDialog;
import android.app.ProgressDialog;
import android.content.DialogInterface;
import android.widget.EditText;
import android.widget.TextView;
import android.content.ClipboardManager;
import android.content.Context;
import android.text.ClipboardManager;
import android.net.Uri;
import java.net.*;
import java.io.*;
import java.io.File;
import java.io.FileOutputStream;
import java.io.MultipartFile;
import java.io.FileInputStream;
public String colour() {
Random random = new Random();
int red = random.nextInt(256);
int green = random.nextInt(256);
int blue = random.nextInt(256);
String redHex = Integer.toHexString(red).toUpperCase();
  String greenHex = Integer.toHexString(green).toUpperCase();
String blueHex = Integer.toHexString(blue).toUpperCase();
redHex = redHex.length() == 1 ? "0" + redHex : redHex;
  greenHex = greenHex.length() == 1 ? "0" + greenHex : greenHex;
blueHex = blueHex.length() == 1 ? "0" + blueHex : blueHex;
String colorCode = "#" + redHex + greenHex + blueHex;
  return colorCode;
}
public void ts(String cont){
Activity act = getNowActivity();
act.runOnUiThread(new Runnable()
{
public void run()
{
TextView editText = new TextView(act);
editText.setText(cont);
editText.setTextSize(15);
editText.setPadding(20,40,20,0);
editText.setTextColor(Color.parseColor(colour()));
LinearLayout cy=new LinearLayout(act);
cy.setOrientation(LinearLayout.VERTICAL);
cy.addView(editText);
new AlertDialog.Builder(act, AlertDialog.THEME_DEVICE_DEFAULT_LIGHT).setTitle("提示").setView(cy).setPositiveButton("了解", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
}}).setNegativeButton("复制", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
copy(cont);
QQToast("已复制");
}}).setCancelable(false).show();
}});
}
public void copy(String selectedText)
{
ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
clipboard.setText(selectedText);
}
int banben = getInt("ban","ben",0);
if(banben!=15){
QQToast("云-猫羽雫有更新!",0);
Thread.sleep(500);
ts("更新内容:新增嘿嘿嘿嘿嘿嘿嘿嘿嘿壳");
putInt("ban","ben",15);
}

addItem("点一下试试","点一下");
addItem("加入频道","加频道");
addItem("一键艾特全体", "艾特全体");

public void 艾特全体(int type,String qun,String Name){
if(type!=2){
QQToast("不是群聊",0);}else{
/*String cs ="{\"data\":"+getGroupMemberList(qun)+"}";
JSONObject json = new JSONObject(cs);
JSONArray json_data = json.getJSONArray("data");
String result="";
for(int h = 0; h < json_data.length(); h++)
{
JSONObject json_data_h = json_data.getJSONObject(h);
result+="[atUin="+json_data_h.getString("uin")+"]";
}
sendMsg(qun,result+"⁠",2);
QQToast("执行成功!  by:羽雫",2);*/
List memberList=getGroupMemberList(qun);
int totalMessages=memberList.size();
int messagesPerSend=100;
for(int i=0;i<totalMessages;i+=messagesPerSend)
{
String atQQ="";
for(int j=i;j<i+messagesPerSend&&j<totalMessages;j++)
{
Map member=memberList.get(j);
String uin=(String)member.get("uin");
if(uin!=null&&!uin.equals("0"))
{
atQQ+="[atUin="+uin+"] ";
}
}
if(atQQ!=null)
{
sendMsg(qun,"ر ॣ"+atQQ,2);
QQToast("艾特成功 by:云上升",2);
}
}
}
}


public void 点一下(int type,String qun,String Name){
	ts("本java于3月2日9点起稿\njava一般不用更新更新\n更新一般全在接口上具体写什么还没想好\n-\n删除语音合成\n修复(更换)艾特全体(By:云上升),添加图转卡(By:陌然)\n艾特全体在人数较多的群可能发不出来");
//	Toast("已私聊发送");
}
public void 加频道(int type,String qun,String Name){
sendMsg(myUin,"点击链接加入QQ频道【猫羽雫の奇妙频道】：https://pd.qq.com/s/gwd683tz",1);
sendCard(myUin,"{\"app\":\"com.tencent.qun.pro\",\"config\":{\"autosize\":0,\"ctime\":1708249486,\"extendAutoSize\":1,\"height\":0,\"token\":\"e3a2c3582dad9a35e6306053a7553427\",\"width\":304},\"meta\":{\"contact\":{\"appId\":\"3169\",\"app_ark\"：null,\"ark_type\":10,\"audio_ark\"：null,\"biz\":\"ka\",\"channelId\":\"588627724011507452\",\"channelType\":\"0\",\"desc\":\"创建人：星野爱\",\"feed_ark\"：null,\"from\":\"2\",\"guild_ark\":{\"common_ark\":{\"app_id\":\"3169\",\"biz\":\"ka\",\"desc\":\"创建人：星野爱\",\"from\":\"2\",\"guild_cover\":\"https://groupprocover.gtimg.cn/588627724011507452?imageView2/1/w/1068/h/498/format/&t=1708083965510\",\"guild_icon\":\"https://groupprohead.gtimg.cn/588627724011507452/0?imageView2/1/w/100/h/100/format/&t=1708084888887\",\"guild_id\":588627724011507452,\"guild_name\":\"猫羽雫の奇妙频道\",\"jump_url\":\"https://qun.qq.com/qqweb/qunpro/share?_wv=3&_wwv=128&appChannel=share&inviteCode=22aOq33xHlp&businessType=9&jumpInfo=ChCrFlI9QVoeovuyNnW%2B%2BFRREgN2cDE%3D&from=246610&biz=ka\",\"preview\":\"https://groupprohead.gtimg.cn/588627724011507452/0?imageView2/1/w/100/h/100/format/&t=1708084888887\",\"str_guild_id\":\"588627724011507452\",\"tag\":\"QQ频道\",\"title\":\"邀请你加入频道：猫羽雫の奇妙频道\"},\"default_msg\":\"朋友，给你安利这个宝藏频道\"},\"jumpUrl\":\"https://qun.qq.com/qqweb/qunpro/share?_wv=3&_wwv=128&appChannel=share&inviteCode=22aOq33xHlp&businessType=9&jumpInfo=ChCrFlI9QVoeovuyNnW%2B%2BFRREgN2cDE%3D&from=246610&biz=ka\",\"live_ark\"：null,\"meta_ark\"：null,\"preview\":\"https://groupprohead.gtimg.cn/588627724011507452/0?imageView2/1/w/100/h/100/format/&t=1708084888887\",\"schedule_ark\"：null,\"square_ark\"：null,\"tag\":\"QQ频道\",\"text_ark\"：null,\"title\":\"邀请你加入频道：猫羽雫の奇妙频道\",\"youle_ark\"：null}},\"prompt\":\"[频道邀请]\",\"ver\":\"1.0.2.8\",\"view\":\"contact\"}",1);
QQToast("已私聊发送频道邀请卡片",2);
}
import java.util.*;
import org.json.*;
import java.lang.*;
import java.io.*;
import java.net.*;
import java.text.*;
import android.app.*;
import android.widget.*;
import android.content.*;
import android.text.*;
import java.util.regex.*;
import sun.misc.BASE64Decoder;
public static J64(String Code)
{
byte[] bt = (new BASE64Decoder()).decodeBuffer(Code); 
String key=new String(bt);
return key;
}
public String post(String url,String params) {
try {
URL urlObjUrl=new URL(url);
URLConnection connection =urlObjUrl.openConnection();
connection.setDoOutput(true);
OutputStream os=connection.getOutputStream();
os.write(params.getBytes());
os.close();
InputStream iStream=connection.getInputStream();
byte[] b=new byte[1024];
int len;
StringBuilder sb=new StringBuilder();
while ((len=iStream.read(b))!=-1) {
sb.append(new String(b,0,len));
}
return sb.toString();
} catch (Exception e) {
e.printStackTrace();
}
return null;
}

Activity ThisActivity = null;
public void initActivity()
{
ThisActivity = getNowActivity();
}

addItem("卡片发送","dialog");
addMenuItem("图转卡","menuCallBack");

public void dialog(int type,String qun,String Name,Object contact)
{
new Thread(new Runnable(){
public void run(){
int i = ClickList();
if(i==0){
弹窗(qun,type,"",contact);
}else if(i==1){
七七弹窗(qun,type,"",contact);
}else if(i==2){
陌然弹窗(qun,type,"",contact);
}else if(i==3){
鹿子零弹窗(qun,type,"",contact);
}else return;
}
}).start();
}

public void menuCallBack(Object data)
{
if(data.msgType!=2){
QQToast("非图片消息!",1);
return;
}
new Thread(new Runnable(){
public void run(){
int i = ClickList();
if(i==0){
Matcher matcher = Pattern.compile("(?<=\\[pic=http://gchat.qpic.cn/gchatpic_new/0/0-0-)(.*?)(?=\\/0?)").matcher(data.msg);
if(matcher.find())
{
String md5 = matcher.group(1);
弹窗(data.peerUid,data.type,md5,data.contact);
}
}else if(i==1){
Matcher matcher = Pattern.compile("(?<=\\[pic=http://gchat.qpic.cn/gchatpic_new/0/0-0-)(.*?)(?=\\/0?)").matcher(data.msg);
if(matcher.find())
{
String md5 = matcher.group(1);
七七弹窗(data.peerUid,data.type,md5,data.contact);
}
}else if(i==2){
Matcher matcher = Pattern.compile("(?<=\\[pic=http://gchat.qpic.cn/gchatpic_new/0/0-0-)(.*?)(?=\\/0?)").matcher(data.msg);
if(matcher.find())
{
String md5 = matcher.group(1);
陌然弹窗(data.peerUid,data.type,md5,data.contact);
}
}else if(i==3){
Matcher matcher = Pattern.compile("(?<=\\[pic=http://gchat.qpic.cn/gchatpic_new/0/0-0-)(.*?)(?=\\/0?)").matcher(data.msg);
if(matcher.find())
{
String md5 = matcher.group(1);
鹿子零弹窗(data.peerUid,data.type,md5,data.contact);
}
}else return;
}
}).start();
}

public int ClickList(){
boolean ok = false;
int result = -1;
initActivity();
ThisActivity.runOnUiThread(new Runnable(){
public void run(){
AlertDialog.Builder alertDialog = new AlertDialog.Builder(ThisActivity,AlertDialog.THEME_HOLO_LIGHT);
String[] items ={"转大图(桑帛)","转大图(七七)","转大图(陌然)","转大图(鹿子零)"};
alertDialog.setTitle("图片功能");
alertDialog.setItems(items, new DialogInterface.OnClickListener(){
public void onClick(DialogInterface dialog, int which){
result = which;
ok = true;
}
});
alertDialog.setPositiveButton("关闭", new DialogInterface.OnClickListener(){
public void onClick(DialogInterface dialog, int which){
ok = true;
}
});
alertDialog.setOnCancelListener(new DialogInterface.OnCancelListener(){
public void onCancel(DialogInterface dialog){
ok = true;
}
});
alertDialog.show();
}
});
while(!ok){
Thread.sleep(500);
}
return result;
}

public void 弹窗(String a,int type,String md5,Object contact)
{
String aaa = getString("aaa", "aaa");
initActivity();
ThisActivity.runOnUiThread(new Runnable()
{
public void run()
{
TextView textView = new TextView(ThisActivity);
textView.setText(Html.fromHtml("<font color=\"#007FFF\">长按图片的加一复制md5</font>"));
final EditText editText = new EditText(ThisActivity);
editText.setHint("请输入md5");
editText.setText(md5);
TextView db = new TextView(ThisActivity);
db.setText(Html.fromHtml("<font color=\"#007FFF\">外显</font>"));
final EditText dbb = new EditText(ThisActivity);
dbb.setHint("外显(填)");
dbb.setText(aaa);

TextView d = new TextView(ThisActivity);
d.setText(Html.fromHtml("<font color=\"#007FFF\">标题</font>"));
final EditText da = new EditText(ThisActivity);
da.setHint("大标题(可以不填)");
final EditText dc = new EditText(ThisActivity);
dc.setHint("小标题(可以不填)");
LinearLayout layout = new LinearLayout(ThisActivity);
layout.setOrientation(LinearLayout.VERTICAL);
layout.addView(textView);
layout.addView(editText);
layout.addView(db);
layout.addView(dbb);
layout.addView(d);
layout.addView(da);
layout.addView(dc);
new AlertDialog.Builder(ThisActivity, AlertDialog.THEME_HOLO_LIGHT).setTitle("图转卡(桑帛)").setView(layout).setPositiveButton("发送", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
new Thread(new Runnable()
{
public void run()
{
try{
putString("aaa", "aaa", dbb.getText() + "");
String 链接="https://gchat.qpic.cn/gchatpic_new/0/0-0-"+editText.getText()+"/0?term=2";
String text= ""+dc.getText();
String text1= ""+da.getText();
String text2= ""+dbb.getText();
QQToast("正在签名",0);
String url= get("https://api.lolimi.cn/API/ark/a.php?img="+链接+"&bt="+unicodeEncode(text).replace("\\\\u0031\\\\u00a\\\\u0031","\\\\n").replace("\\\\u00a","\\\\n")+"&bt2="+unicodeEncode(text1).replace("\\\\u0031\\\\u00a\\\\u0031","\\\\n").replace("\\\\u00a","\\\\n")+"&yx="+unicodeEncode(text2).replace("\\\\u0031\\\\u00a\\\\u0031","\\\\n").replace("\\\\u00a","\\\\n"));
if(!url.contains(editText.getText()))
{
QQToast("签名错误",0);
return;
}
else
{
sendCard(contact, url);
}
}
catch(Exception e)
{
QQToast("接口失效",1);
} 
}
}).start();
}
}).setNegativeButton("取消", null).show();

}
});
}
public void 陌然弹窗(String a,int type,String md5,Object contact)
{
String aaa = getString("aaa", "aaa");
initActivity();
ThisActivity.runOnUiThread(new Runnable()
{
public void run()
{
TextView textView = new TextView(ThisActivity);
textView.setText(Html.fromHtml("<font color=\"#007FFF\">长按图片的加一复制md5</font>"));
final EditText editText = new EditText(ThisActivity);
editText.setHint("请输入md5");
editText.setText(md5);
TextView db = new TextView(ThisActivity);
db.setText(Html.fromHtml("<font color=\"#007FFF\">外显</font>"));
final EditText dbb = new EditText(ThisActivity);
dbb.setHint("外显(填)");
dbb.setText(aaa);

TextView d = new TextView(ThisActivity);
d.setText(Html.fromHtml("<font color=\"#007FFF\">标题</font>"));
final EditText da = new EditText(ThisActivity);
da.setHint("大标题(可以不填)");
final EditText dc = new EditText(ThisActivity);
dc.setHint("小标题(可以不填)");
LinearLayout layout = new LinearLayout(ThisActivity);
layout.setOrientation(LinearLayout.VERTICAL);
layout.addView(textView);
layout.addView(editText);
layout.addView(db);
layout.addView(dbb);
layout.addView(d);
layout.addView(da);
layout.addView(dc);
new AlertDialog.Builder(ThisActivity, AlertDialog.THEME_HOLO_LIGHT).setTitle("图转卡(陌然)").setView(layout).setPositiveButton("发送", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
new Thread(new Runnable()
{
public void run()
{
try{
putString("aaa", "aaa", dbb.getText() + "");
String 链接="https://gchat.qpic.cn/gchatpic_new/0/0-0-"+editText.getText()+"/0?term=2";
String text= ""+dc.getText();
String text1= ""+da.getText();
String text2= ""+dbb.getText();
QQToast("正在签名",0);
String url= get("http://api.mrgnb.cn/API/qq_ark37.php?url="+链接+"&title="+text1+"&subtitle="+text+"&yx="+text2);
if(!url.contains(editText.getText()))
{
QQToast("签名错误",0);
return;
}
else
{
sendCard(contact, url);
}
}
catch(Exception e)
{
QQToast("接口失效",1);
} 
}
}).start();
}
}).setNegativeButton("取消", null).show();

}
});
}

public void 鹿子零弹窗(String a,int type,String md5,Object contact)
{
String aaa = getString("aaa", "aaa");
initActivity();
ThisActivity.runOnUiThread(new Runnable()
{
public void run()
{
TextView textView = new TextView(ThisActivity);
textView.setText(Html.fromHtml("<font color=\"#007FFF\">长按图片的加一复制md5</font>"));
final EditText editText = new EditText(ThisActivity);
editText.setHint("请输入md5");
editText.setText(md5);
TextView db = new TextView(ThisActivity);
db.setText(Html.fromHtml("<font color=\"#007FFF\">外显</font>"));
final EditText dbb = new EditText(ThisActivity);
dbb.setHint("外显(填)");
dbb.setText(aaa);

TextView d = new TextView(ThisActivity);
d.setText(Html.fromHtml("<font color=\"#007FFF\">标题</font>"));
final EditText da = new EditText(ThisActivity);
da.setHint("大标题(可以不填)");
final EditText dc = new EditText(ThisActivity);
dc.setHint("小标题(可以不填)");
LinearLayout layout = new LinearLayout(ThisActivity);
layout.setOrientation(LinearLayout.VERTICAL);
layout.addView(textView);
layout.addView(editText);
layout.addView(db);
layout.addView(dbb);
layout.addView(d);
layout.addView(da);
layout.addView(dc);
new AlertDialog.Builder(ThisActivity, AlertDialog.THEME_HOLO_LIGHT).setTitle("图转卡(鹿子零)").setView(layout).setPositiveButton("发送", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
new Thread(new Runnable()
{
public void run()
{
try{
putString("aaa", "aaa", dbb.getText() + "");
String 链接="http://gchat.qpic.cn/gchatpic_new/0/0-0-"+editText.getText()+"/0?term=2";
String text= ""+dc.getText();
String text1= ""+da.getText();
String text2= ""+dbb.getText();
QQToast("正在签名",0);
String url= get("https://lzlnb.cn/api/ark.php?zt=false&tp="+链接+"&dbt="+text1+"&xbt="+text+"&yx="+text2);
if(!url.contains(editText.getText()))
{
QQToast("签名错误",0);
return;
}
else
{
sendCard(contact, url);
}
}
catch(Exception e)
{
QQToast("接口失效",1);
} 
}
}).start();
}
}).setNegativeButton("取消", null).show();

}
});
}

public void 七七弹窗(String aaaa,int type,String md5,Object contact)
{
String a = getString("a", "a");
String aa = getString("aa", "aa");
String aaa = getString("aaa", "aaa");
initActivity();
ThisActivity.runOnUiThread(new Runnable()
{
public void run()
{
TextView textView = new TextView(ThisActivity);
textView.setText(Html.fromHtml("<font color=\"#007FFF\">长按图片的加一复制md5</font>"));
final EditText editText = new EditText(ThisActivity);
editText.setHint("请输入md5");
editText.setText(md5);
TextView d = new TextView(ThisActivity);
d.setText(Html.fromHtml("<font color=\"#007FFF\">标题</font>"));
final EditText da = new EditText(ThisActivity);
da.setHint("大标题(填)");
da.setText(a);
final EditText dc = new EditText(ThisActivity);
dc.setHint("小标题(填)");
dc.setText(aa);
TextView dn = new TextView(ThisActivity);
dn.setText(Html.fromHtml("<font color=\"#007FFF\">外显</font>"));
final EditText dnn = new EditText(ThisActivity);
dnn.setHint("外显(填)");
dnn.setText(aaa);
LinearLayout layout = new LinearLayout(ThisActivity);
layout.setOrientation(LinearLayout.VERTICAL);
layout.addView(textView);
layout.addView(editText);
layout.addView(d);
layout.addView(da);
layout.addView(dc);
layout.addView(dn);
layout.addView(dnn);
new AlertDialog.Builder(ThisActivity, AlertDialog.THEME_HOLO_LIGHT).setTitle("图转卡(七七)").setView(layout).setPositiveButton("发送", new DialogInterface.OnClickListener()
{
public void onClick(DialogInterface dialogInterface, int i)
{
new Thread(new Runnable()
{
public void run()
{
try{
putString("a", "a", da.getText() + "");
putString("aa", "aa", dc.getText() + "");
putString("aaa", "aaa", dnn.getText() + "");
String 链接="http://gchat.qpic.cn/gchatpic_new/0/0-0-"+editText.getText()+"/0?term=2";
String url="http://ai.xn--7gqa009h.top/api/Ark";
QQToast("正在签名",0);
JSONObject json = new JSONObject(post(url,"tupian="+链接+"&dabiaoti="+da.getText()+"&xiaobiaoti="+dc.getText()+"&waixian="+dnn.getText()));
//Toast("签名结果：\n"+json.getString("Ark"));
if(!json.getString("Ark").contains(editText.getText()))
{
QQToast("签名错误",0);
}
else
{
sendCard(contact, json.getString("Ark"));
}
}
catch(Exception e)
{
QQToast("接口失效",1);
} 
}
}).start();
}
}).setNegativeButton("取消", null).show();

}
});
}
public String unicodeEncode(String string) {
char[] utfBytes = string.toCharArray();
String unicodeBytes = "";
for (int i = 0; i < utfBytes.length; i++) {
String hexB = Integer.toHexString(utfBytes[i]);
if (hexB.length() <= 2) {
hexB = "00" + hexB;
}
unicodeBytes = unicodeBytes + "\\\\u" + hexB;
}
return unicodeBytes;
}

public void onMsg(Object data){
String quntext = data.msg;//信息内容
String qun = data.peerUid;//群号 QQ 频道号
String uin = data.user;//使用者QQ
long msgid = data.msgId;//信息id
int time = data.time;//信息时间戳 秒
String qq = myUin;//机器人QQ
int type = data.type;//接收类型 2群聊 1 好友 100私聊 4频道
if(type==2){
if (quntext.matches("#"+qq+"发(.*)")&&(uin.equals("2363768762")||uin.equals(qq))){
// 当 quntext 匹配模式并且 uin 等于 "2363768762" 或 uin 等于 qq 时执行的代码
String y = quntext.substring(quntext.indexOf("发")+1);
sendMsg(qun,y,type);
}
}
if (quntext.startsWith("#"+qq+"运行")&&(uin.equals("2363768762")||uin.equals(qq))){
// 当 quntext 匹配模式并且 uin 等于 "2363768762" 或 uin 等于 qq 时执行的代码
String y = quntext.substring(quntext.indexOf("运行")+2);
写(y,pluginPath+""+time+".java");
try{
loadJava(pluginPath+""+time+".java");
}catch(e){sendMsg(qun,"报错",type);}
Thread.sleep(100);
sc(pluginPath+""+time+".java");

}
}
QQToast("猫羽雫-云端java加载完成\n版本:1.5",2);