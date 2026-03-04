---
title: Local File Inclusion
parent: HTTP
nav_order: 1
---

# Local File Inclusion
<br>
백엔드에서 파일이나 페이지 등을 불러올 때 발생하는 취약점으로 공격자가 원하는 파일을 불러오는 공격이다

<br>
일반적인 웹 서버를 실행할 때의 유저 계정은 www-data 등의 권한이 낮은 유저이다<br>
따라서 특정 파일을 향한 LFI 공격이 실패할 때는 지금 사용 중인 유저 권한이 해당 파일과 관련된 **읽기** 권한이 없거나 파일 자체가 없는 경우이다

공격자는 파일을 읽거나 악성 파일을 가져와 실행시키는 공격이 가능하다

공격자는 다음과 같은 파일을 중점적으로 노린다
1. 파일 시스템 안의 중요 파일
2. 네트워크 서비스들의 설정 파일
3. 유저의 개인적인 파일
4. 웹 서버가 갖고 있지만 현재 접근 불가능한 다른 웹 관련 파일

<br>

## 파일 시스템 안의 중요 파일

- /etc/passwd
- /etc/shadow
- /etc/hosts
> 호스트 이름과 IP 주소의 매핑을 통해 해당 호스트가 소통 중인 다른 호스트의 존재 파악 가능
- /var/log/apache2/access.log
> 유저들이 방문한 디렉토리나 파일들의 경로, IP주소, 찾지 못했던 디렉토리 경로, 특정 유저의 활동 시간 등 각종 민감한 정보 확인 가능
<br>

## 네트워크 서비스들의 설정 파일

- HTTP + NFS : /etc/exports
> no_root_squash 설정 확인 후 후속공격에 활용
- HTTP + SMB : /etc/samba/smb.conf
> samba의 share 디렉토리 경로 확인
- HTTP + wordpress : /var/www/html/워드프레스경로/wp-config.php
> 백엔드 데이터베이스와 관련된 계정 정보 확인
> 데이터베이스 유저 이름과 비밀번호를 바탕으로 데이터베이스 접근
<br>

## 유저의 개인적인 파일

- /home/유저/.bash_history
> others에 읽기 권한이 있을 수도 있으니 확인해 보는 것이 좋다
- /home/유저/.mysql_history
- /home/유저/.my.cnf
> mysql이나 mariaDB의 설정 파일
> client문에 유저 이름과 비밀번호가 하드코딩 되어 있는 경우가 있다
- /home/유저/.ssh/id_rsa
> 유저의 SSH 개인키
> other에게 읽기 권한이 있을 수도 있으니 확인해 보는 것이 좋다

<br>

---

## 실습
<br>

아래는 실습할 머신에 접속한 모습이다.
<br><br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/1_target.png' | relative_url }}" style="width:400px;">
    <figcaption>target</figcaption>
</figure>
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/1_passwd.png' | relative_url }}" style="width:400px;">
    <figcaption>/etc/passwd</figcaption>
</figure>

url에 /etc/passwd 경로를 지정해줬더니 passwd 파일을 불러오는 모습이다

이런 취약점을 활용해 공격해보자<br>
burp suite의 repeater 기능을 통해

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/2_passwd.png' | relative_url }}" style="width:600px;">
    <figcaption>/etc/passwd</figcaption>
</figure>
<br>

groot와 ubuntu 라는 일반 사용자 계정을 획득했다.

이번엔 획득한 계정의 홈 디렉토리 안에 있는 .bash_history 파일을 살펴보자
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/3_bashhistory.png' | relative_url }}" style="width:600px;">
    <figcaption>.bash_history</figcaption>
</figure>
<br>

아무것도 나오지 않는 것으로 읽기 권한이 없다는 것을 확인했다.
<br>

이번엔 ssh의 비밀키 파일인 .ssh/id_rsa 파일을 요청해보자
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/4_ssh비밀키.png' | relative_url }}" style="width:600px;">
    <figcaption>id_rsa</figcaption>
</figure>
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/5_ssh.png' | relative_url }}" style="width:450px;">
    <figcaption>ssh 접속</figcaption>
</figure>
<br>

해당 비밀키를 복사한 후 비밀키 파일을 만들고 실행권한 600을 준 후 비밀키로 ssh 에 접속 성공했다.

---
---

타겟 머신을 포트 스캔한 결과 
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/6_portscan.png' | relative_url }}" style="width:400px;">
    <figcaption>port scan</figcaption>
</figure>
<br>
445번포트에 samba 서비스가 열려있다는 것을 알았다.

이제 어떤 공유 폴더가 열려있는지 확인할 차례다
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/7_samba.png' | relative_url }}" style="width:400px;">
    <figcaption>공유 폴더 확인</figcaption>
</figure>
<br>

열려있는 공유 폴더 중 samba-share에 접속해보자
<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/8_samba.png' | relative_url }}" style="width:400px;">
    <figcaption>공유 폴더 접속</figcaption>
</figure>
<br>

잘은 모르겠지만 파일을 업로드 할 수 있고 그 업로드한 파일을 LFI 취약점으로 실행할 수도 있을 거라는 추측이 가능하다

하지만 문제가 있다


웹에서 samba-share로 들어가보려 했더니 
<br><br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/9_notfound.png' | relative_url }}" style="width:300px;">
    <figcaption>Not Found</figcaption>
</figure>
<br>

존재하지 않는다면서 Not Found 라는 메시지가 떴다.

Not Found가 뜨는 이유는 실제 경로와 smbclient 상의 경로가 다르기 때문이다
즉, 매핑되어있다는 뜻이다

정확한 정보를 확인하기 위해 samba의 설정파일을 확인해보자

> samba의 설정파일 위치<br>
> /etc/samba/smb.conf
<br>

burp suite에서 해당 경로를 요청해보면

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/10_smbconf.png' | relative_url }}" style="width:600px;">
    <figcaption>smb.conf</figcaption>
</figure>
<br>

경로와 권한 등 각종 설정이 나온다

얻은 정보를 통해 리버스 쉘을 업로드 하고 쉘 세션을 얻어보도록 하자

<br>
<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/11_리버스쉘.png' | relative_url }}" style="width:600px;">
    <figcaption>reverse shell</figcaption>
</figure>
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/12_업로드.png' | relative_url }}" style="width:400px;">
    <figcaption>reverse shell 업로드</figcaption>
</figure>
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/13_실행.png' | relative_url }}" style="width:400px;">
    <figcaption>요청 실행</figcaption>
</figure>
<br>

<figure style="text-align:center;">
    <img src="{{ '/assets/images/http/lfi/14_세션연결.png' | relative_url }}" style="width:400px;">
    <figcaption>연결 성공</figcaption>
</figure>
<br>
설정 파일에서 얻은 실제 경로를 요청해보면 미리 열어둔 1234번 포트에 리버스 쉘 세션 연결이 성공한 것을 볼 수 있다.