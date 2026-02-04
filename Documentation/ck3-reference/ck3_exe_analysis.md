# CK3 Executable Analysis

**File**: `C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\binaries\ck3.exe`  
**Analysis Tool**: BelaUtils bona v2.0.3  
**Date**: February 4, 2026

---

## Executive Summary

| Property | Value |
|----------|-------|
| **Type** | PE executable file (64-bit Windows GUI) |
| **Size** | 93,388,408 bytes (~89 MB) |
| **Architecture** | AMD64 |
| **Subsystem** | Windows GUI |
| **MIME Type** | application/vnd.microsoft.portable-executable |

### Security Features
- Large address aware
- High entropy VA (ASLR)
- Dynamic base
- NX compatible (DEP)
- Terminal server aware

### PE Sections Overview

| Section | Size | Purpose |
|---------|------|---------|
| `.text` | 65.6 MB | Executable code |
| `.rdata` | 15.9 MB | Read-only data (strings, constants) |
| `.data` | 8 MB | Initialized data |
| `.pdata` | 2.7 MB | Exception handling info |
| `_RDATA` | 1.5 KB | Additional read-only data |
| `.rsrc` | 79 KB | Resources (icons, version info) |
| `.reloc` | 1 MB | Relocation data |

### Key Dependencies by Category

| Category | DLLs | Purpose |
|----------|------|---------|
| **Audio** | fmodstudio.dll, fmod.dll | FMOD sound engine |
| **Video** | bink2w64.dll | Bink video codec (cinematics) |
| **Graphics** | d3d11.dll, dxgi.dll, D3DCOMPILER_47.dll, dxcompiler.dll | DirectX 11 rendering |
| **Textures** | nvtt.dll | NVIDIA Texture Tools (DXT compression) |
| **Steam** | steam_api64.dll | Steam platform integration |
| **Multiplayer** | nakama-cpp.dll | Heroic Labs Nakama networking |
| **Paradox** | pops_api.dll | Paradox accounts, telemetry, inventory |
| **Windows** | USER32.dll, KERNEL32.dll, GDI32.dll, etc. | Core Windows APIs |

### GPU Selection
The executable exports symbols to request dedicated GPU on hybrid systems:
- `NvOptimusEnablement` - NVIDIA Optimus laptops
- `AmdPowerXpressRequestHighPerformance` - AMD switchable graphics

---

## Full Verbose Analysis Output

```
Description:    PE executable file
Path:           C:\Program Files (x86)\Steam\steamapps\common\Crusader Kings III\binaries\ck3.exe
Size:           93388408
MIME:           application/vnd.microsoft.portable-executable
Machine:        AMD64
Is64Bit:        true
Subsystem:      Windows GUI
Characteristic: Executable
                Large address aware
                High entropy VA
                Dynamic base
                NX compatible
                Terminal server aware
OverlayLen:     10360
Overlay:        Binary data
```

### PE Sections

#### .text (Code Section)
```
.text
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1610612768
  Offset:               1024
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 65620992
  VirtualAddress:       4096
  VirtualSize:          65620980
```

#### .rdata (Read-Only Data)
```
.rdata
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1073741888
  Offset:               65622016
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 15859712
  VirtualAddress:       65626112
  VirtualSize:          15859538
```

#### .data (Initialized Data)
```
.data
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      3221225536
  Offset:               81481728
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 8023040
  VirtualAddress:       81485824
  VirtualSize:          9436865
```

#### .pdata (Exception Handling)
```
.pdata
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1073741888
  Offset:               89504768
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 2717696
  VirtualAddress:       90923008
  VirtualSize:          2717376
```

#### _RDATA
```
_RDATA
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1073741888
  Offset:               92222464
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 1536
  VirtualAddress:       93642752
  VirtualSize:          1040
```

#### .rsrc (Resources)
```
.rsrc
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1073741888
  Offset:               92224000
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 79872
  VirtualAddress:       93646848
  VirtualSize:          79496
```

#### .reloc (Relocations)
```
.reloc
  NumberOfLineNumbers:  0
  NumberOfRelocations:  0
  Characteristics:      1107296320
  Offset:               92303872
  PointerToLineNumbers: 0
  PointerToRelocations: 0
  Size:                 1074176
  VirtualAddress:       93728768
  VirtualSize:          1073744
```

---

## Imported Functions by DLL

### fmodstudio.dll (FMOD Studio Audio)

FMOD Studio is used for the game's audio system, including music and sound effects.

```
0   FMOD::Studio::System::create(FMOD::Studio::System**, unsigned int)
1   FMOD::Studio::EventDescription::createInstance(FMOD::Studio::EventInstance**)
4   FMOD::Studio::EventInstance::get3DAttributes(FMOD_3D_ATTRIBUTES*)
6   FMOD::Studio::System::getBank(char const*, FMOD::Studio::Bank**)
8   FMOD::Studio::System::getBankCount(int*)
9   FMOD::Studio::System::getBankList(FMOD::Studio::Bank**, int, int*)
11  FMOD::Studio::System::getBus(char const*, FMOD::Studio::Bus**)
13  FMOD::Studio::Bank::getBusCount(int*)
14  FMOD::Studio::Bank::getBusList(FMOD::Studio::Bus**, int, int*)
18  FMOD::Studio::Bus::getChannelGroup(FMOD::ChannelGroup**)
24  FMOD::Studio::System::getCoreSystem(FMOD::System**)
26  FMOD::Studio::EventInstance::getDescription(FMOD::Studio::EventDescription**)
27  FMOD::Studio::System::getEvent(char const*, FMOD::Studio::EventDescription**)
29  FMOD::Studio::Bank::getEventCount(int*)
30  FMOD::Studio::Bank::getEventList(FMOD::Studio::EventDescription**, int, int*)
35  FMOD::Studio::EventDescription::getInstanceCount(int*)
36  FMOD::Studio::EventDescription::getInstanceList(FMOD::Studio::EventInstance**, int, int*)
38  FMOD::Studio::EventDescription::getLength(int*)
39  FMOD::Studio::System::getListenerAttributes(int, FMOD_3D_ATTRIBUTES*, FMOD_VECTOR*)
40  FMOD::Studio::EventInstance::getListenerMask(unsigned int*)
41  FMOD::Studio::System::getListenerWeight(int, float*)
46  FMOD::Studio::EventDescription::getMinMaxDistance(float*, float*)
48  FMOD::Studio::Bus::getMute(bool*)
49  FMOD::Studio::System::getNumListeners(int*)
50  FMOD::Studio::EventInstance::getParameterByID(FMOD_STUDIO_PARAMETER_ID, float*, float*)
51  FMOD::Studio::System::getParameterByID(FMOD_STUDIO_PARAMETER_ID, float*, float*)
52  FMOD::Studio::EventInstance::getParameterByName(char const*, float*, float*)
54  FMOD::Studio::EventDescription::getParameterDescriptionByID(FMOD_STUDIO_PARAMETER_ID, FMOD_STUDIO_PARAMETER_DESCRIPTION*)
55  FMOD::Studio::System::getParameterDescriptionByID(FMOD_STUDIO_PARAMETER_ID, FMOD_STUDIO_PARAMETER_DESCRIPTION*)
56  FMOD::Studio::EventDescription::getParameterDescriptionByIndex(int, FMOD_STUDIO_PARAMETER_DESCRIPTION*)
57  FMOD::Studio::EventDescription::getParameterDescriptionByName(char const*, FMOD_STUDIO_PARAMETER_DESCRIPTION*)
58  FMOD::Studio::System::getParameterDescriptionByName(char const*, FMOD_STUDIO_PARAMETER_DESCRIPTION*)
59  FMOD::Studio::EventDescription::getParameterDescriptionCount(int*)
60  FMOD::Studio::System::getParameterDescriptionCount(int*)
61  FMOD::Studio::System::getParameterDescriptionList(FMOD_STUDIO_PARAMETER_DESCRIPTION*, int, int*)
67  FMOD::Studio::Bank::getPath(char*, int, int*)
68  FMOD::Studio::Bus::getPath(char*, int, int*)
69  FMOD::Studio::EventDescription::getPath(char*, int, int*)
70  FMOD::Studio::VCA::getPath(char*, int, int*)
71  FMOD::Studio::Bus::getPaused(bool*)
73  FMOD::Studio::EventInstance::getPaused(bool*)
76  FMOD::Studio::EventInstance::getPlaybackState(FMOD_STUDIO_PLAYBACK_STATE*)
87  FMOD::Studio::EventInstance::getTimelinePosition(int*)
88  FMOD::Studio::Bank::getUserData(void**)
90  FMOD::Studio::EventDescription::getUserData(void**)
91  FMOD::Studio::EventInstance::getUserData(void**)
96  FMOD::Studio::System::getVCA(char const*, FMOD::Studio::VCA**)
98  FMOD::Studio::Bank::getVCACount(int*)
99  FMOD::Studio::Bank::getVCAList(FMOD::Studio::VCA**, int, int*)
100 FMOD::Studio::Bus::getVolume(float*, float*)
101 FMOD::Studio::EventInstance::getVolume(float*, float*)
102 FMOD::Studio::VCA::getVolume(float*, float*)
104 FMOD::Studio::System::initialize(int, unsigned int, unsigned int, void*)
105 FMOD::Studio::EventDescription::is3D(bool*)
114 FMOD::Studio::EventInstance::isValid()
117 FMOD::Studio::EventInstance::isVirtual(bool*)
120 FMOD::Studio::System::loadBankFile(char const*, unsigned int, FMOD::Studio::Bank**)
123 FMOD::Studio::Bank::loadSampleData()
124 FMOD::Studio::EventDescription::loadSampleData()
125 FMOD::Studio::Bus::lockChannelGroup()
130 FMOD::Studio::EventInstance::release()
131 FMOD::Studio::System::release()
136 FMOD::Studio::EventInstance::set3DAttributes(FMOD_3D_ATTRIBUTES const*)
140 FMOD::Studio::EventInstance::setCallback(...)
144 FMOD::Studio::System::setListenerAttributes(int, FMOD_3D_ATTRIBUTES const*, FMOD_VECTOR const*)
145 FMOD::Studio::EventInstance::setListenerMask(unsigned int)
146 FMOD::Studio::System::setListenerWeight(int, float)
148 FMOD::Studio::Bus::setMute(bool)
149 FMOD::Studio::System::setNumListeners(int)
150 FMOD::Studio::EventInstance::setParameterByID(FMOD_STUDIO_PARAMETER_ID, float, bool)
151 FMOD::Studio::System::setParameterByID(FMOD_STUDIO_PARAMETER_ID, float, bool)
152 FMOD::Studio::EventInstance::setParameterByIDWithLabel(FMOD_STUDIO_PARAMETER_ID, char const*, bool)
153 FMOD::Studio::System::setParameterByIDWithLabel(FMOD_STUDIO_PARAMETER_ID, char const*, bool)
154 FMOD::Studio::EventInstance::setParameterByName(char const*, float, bool)
155 FMOD::Studio::System::setParameterByName(char const*, float, bool)
156 FMOD::Studio::EventInstance::setParameterByNameWithLabel(char const*, char const*, bool)
157 FMOD::Studio::System::setParameterByNameWithLabel(char const*, char const*, bool)
160 FMOD::Studio::Bus::setPaused(bool)
162 FMOD::Studio::EventInstance::setPaused(bool)
167 FMOD::Studio::EventInstance::setTimelinePosition(int)
168 FMOD::Studio::Bank::setUserData(void*)
170 FMOD::Studio::EventDescription::setUserData(void*)
171 FMOD::Studio::EventInstance::setUserData(void*)
173 FMOD::Studio::Bus::setVolume(float)
174 FMOD::Studio::EventInstance::setVolume(float)
175 FMOD::Studio::VCA::setVolume(float)
177 FMOD::Studio::EventInstance::start()
180 FMOD::Studio::EventInstance::stop(FMOD_STUDIO_STOP_MODE)
181 FMOD::Studio::Bus::stopAllEvents(FMOD_STUDIO_STOP_MODE)
183 FMOD::Studio::Bank::unload()
185 FMOD::Studio::Bank::unloadSampleData()
186 FMOD::Studio::EventDescription::unloadSampleData()
187 FMOD::Studio::Bus::unlockChannelGroup()
189 FMOD::Studio::System::update()
```

### fmod.dll (FMOD Core Audio)

```
20  FMOD::System::createStream(char const*, unsigned int, FMOD_CREATESOUNDEXINFO*, FMOD::Sound**)
45  FMOD::System::getAdvancedSettings(FMOD_ADVANCEDSETTINGS*)
49  FMOD::System::getCPUUsage(FMOD_CPU_USAGE*)
54  FMOD::System::getChannelsPlaying(int*, int*)
69  FMOD::System::getFileUsage(__int64*, __int64*, __int64*)
81  FMOD::Sound::getLength(unsigned int*, unsigned int)
105 FMOD::Sound::getName(char*, int)
145 FMOD::Channel::getPosition(unsigned int*, unsigned int)
156 FMOD::System::getSoftwareChannels(int*)
157 FMOD::System::getSoftwareFormat(int*, FMOD_SPEAKERMODE*, int*)
174 FMOD::ChannelControl::getUserData(void**)
180 FMOD::Sound::getUserData(void**)
190 FMOD::ChannelControl::isPlaying(bool*)
200 FMOD::System::playSound(FMOD::Sound*, FMOD::ChannelGroup*, bool, FMOD::Channel**)
211 FMOD::Sound::release()
240 FMOD::System::setAdvancedSettings(FMOD_ADVANCEDSETTINGS*)
242 FMOD::ChannelControl::setCallback(...)
285 FMOD::ChannelControl::setPaused(bool)
290 FMOD::Channel::setPosition(unsigned int, unsigned int)
299 FMOD::System::setSoftwareFormat(int, FMOD_SPEAKERMODE, int)
303 FMOD::ChannelControl::setUserData(void*)
309 FMOD::Sound::setUserData(void*)
318 FMOD::ChannelControl::stop()
905 FMOD_Debug_Initialize
928 FMOD_Memory_GetStats
```

### USER32.dll (Windows User Interface)

```
4   AdjustWindowRectEx
15  AttachThreadInput
31  CallNextHookEx
33  CallWindowProcW
40  ChangeDisplaySettingsExW
77  ClientToScreen
78  ClipCursor
79  CloseClipboard
90  CopyImage
108 CreateIconFromResource
110 CreateIconIndirect
117 CreateWindowExA
118 CreateWindowExW
167 DefWindowProcW
177 DestroyIcon
181 DestroyWindow
184 DialogBoxIndirectParamW
189 DispatchMessageW
222 DrawTextW
232 EmptyClipboard
242 EndDialog
253 EnumDisplayDevicesW
254 EnumDisplayMonitors
258 EnumDisplaySettingsW
272 FillRect
278 FlashWindowEx
289 GetAsyncKeyState
298 GetClassInfoExW
307 GetClientRect
308 GetClipCursor
310 GetClipboardData
314 GetClipboardSequenceNumber
321 GetCursorPos
322 GetDC
325 GetDesktopWindow
332 GetDlgItem
336 GetDoubleClickTime
343 GetFocus
344 GetForegroundWindow
360 GetKeyState
361 GetKeyboardLayout
365 GetKeyboardState
375 GetMenu
390 GetMessageExtraInfo
393 GetMessageW
395 GetMonitorInfoW
400 GetParent
433 GetPropW
436 GetRawInputData
437 GetRawInputDeviceInfoA
439 GetRawInputDeviceList
455 GetSystemMetrics
468 GetUpdateRect
488 GetWindowLongPtrW
489 GetWindowLongW
496 GetWindowRect
502 GetWindowTextLengthW
503 GetWindowTextW
504 GetWindowThreadProcessId
545 IntersectRect
546 InvalidateRect
558 IsClipboardFormatAvailable
565 IsIconic
573 IsRectEmpty
589 IsWindowVisible
592 KillTimer
597 LoadCursorA
599 LoadCursorFromFileW
600 LoadCursorW
602 LoadIconW
638 MapVirtualKeyW
645 MessageBoxA
655 MonitorFromPoint
656 MonitorFromRect
657 MonitorFromWindow
669 OpenClipboard
683 PeekMessageW
687 PostMessageW
690 PostThreadMessageW
697 PtInRect
733 RegisterClassExA
734 RegisterClassExW
735 RegisterClassW
740 RegisterDeviceNotificationW
751 RegisterRawInputDevices
761 RegisterWindowMessageA
763 ReleaseCapture
764 ReleaseDC
770 RemovePropW
777 ScreenToClient
792 SendMessageW
795 SetActiveWindow
796 SetCapture
804 SetClipboardData
808 SetCursor
810 SetCursorPos
823 SetFocus
824 SetForegroundWindow
830 SetLayeredWindowAttributes
849 SetProcessDPIAware
857 SetPropW
875 SetTimer
888 SetWindowLongPtrW
889 SetWindowLongW
891 SetWindowPos
892 SetWindowRgn
896 SetWindowTextW
901 SetWindowsHookExW
904 ShowCursor
909 ShowWindow
923 SystemParametersInfoA
925 SystemParametersInfoW
932 ToUnicode
934 TrackMouseEvent
941 TranslateMessage
946 UnhookWindowsHookEx
951 UnregisterClassA
952 UnregisterClassW
953 UnregisterDeviceNotification
978 ValidateRect
```

### KERNEL32.dll (Windows Core)

```
0   AcquireSRWLockExclusive
1   AcquireSRWLockShared
21  AllocConsole
37  AttachConsole
115 CancelIo
137 CloseHandle
149 CloseThreadpoolWork
155 CompareStringA
156 CompareStringEx
158 CompareStringW
184 CreateDirectoryA
189 CreateDirectoryW
194 CreateEventW
198 CreateFileA
206 CreateFileW
227 CreateProcessA
232 CreateProcessW
239 CreateSemaphoreW
245 CreateThread
251 CreateThreadpoolWork
269 DecodePointer
276 DeleteCriticalSection
281 DeleteFileW
292 DeviceIoControl
308 EncodePointer
312 EnterCriticalSection
348 EnumSystemLocalesW
359 ExitProcess
360 ExitThread
368 FatalExit
371 FileTimeToSystemTime
382 FindClose
388 FindFirstFileExW
393 FindFirstFileW
405 FindNextFileW
424 FlushFileBuffers
431 FormatMessageA
432 FormatMessageW
433 FreeConsole
435 FreeEnvironmentStringsW
436 FreeLibrary
437 FreeLibraryAndExitThread
443 GetACP
458 GetCPInfo
479 GetCommandLineA
480 GetCommandLineW
499 GetConsoleCP
517 GetConsoleMode
521 GetConsoleOutputCP
523 GetConsoleScreenBufferInfo
528 GetConsoleWindow
537 GetCurrentDirectoryA
538 GetCurrentDirectoryW
544 GetCurrentProcess
545 GetCurrentProcessId
548 GetCurrentThread
549 GetCurrentThreadId
555 GetDateFormatW
569 GetDriveTypeW
572 GetDynamicTimeZoneInformation
577 GetEnvironmentStringsW
578 GetEnvironmentVariableA
583 GetExitCodeThread
586 GetFileAttributesA
588 GetFileAttributesExW
591 GetFileAttributesW
593 GetFileInformationByHandle
597 GetFileSize
598 GetFileSizeEx
600 GetFileType
601 GetFinalPathNameByHandleA
611 GetFullPathNameW
618 GetLastError
620 GetLocaleInfoA
622 GetLocaleInfoW
636 GetModuleFileNameA
637 GetModuleFileNameW
638 GetModuleHandleA
640 GetModuleHandleExW
641 GetModuleHandleW
654 GetNativeSystemInfo
673 GetOEMCP
674 GetOverlappedResult
696 GetProcAddress
702 GetProcessHeap
730 GetStartupInfoW
732 GetStdHandle
737 GetStringTypeW
744 GetSystemDefaultUILanguage
749 GetSystemInfo
750 GetSystemPowerStatus
755 GetSystemTimeAsFileTime
769 GetThreadContext
774 GetThreadId
785 GetTickCount
790 GetTimeFormatW
792 GetTimeZoneInformation
798 GetUserDefaultLCID
806 GetVersionExA
825 GlobalAlloc
836 GlobalLock
838 GlobalMemoryStatusEx
843 GlobalUnlock
849 HeapAlloc
853 HeapFree
856 HeapReAlloc
858 HeapSize
867 InitOnceBeginInitialize
868 InitOnceComplete
871 InitializeConditionVariable
875 InitializeCriticalSectionAndSpinCount
876 InitializeCriticalSectionEx
879 InitializeSListHead
880 InitializeSRWLock
885 InterlockedPushEntrySList
901 IsDebuggerPresent
908 IsProcessorFeaturePresent
914 IsValidCodePage
916 IsValidLocale
943 K32GetProcessMemoryInfo
951 LCMapStringEx
952 LCMapStringW
964 LeaveCriticalSection
968 LoadLibraryA
970 LoadLibraryExW
971 LoadLibraryW
982 LocalFree
1007 MoveFileExW
1013 MulDiv
1014 MultiByteToWideChar
1053 OutputDebugStringA
1054 OutputDebugStringW
1063 PeekNamedPipe
1106 QueryPerformanceCounter
1107 QueryPerformanceFrequency
1128 RaiseException
1136 ReadConsoleInputW
1142 ReadConsoleW
1144 ReadDirectoryChangesW
1145 ReadFile
1148 ReadProcessMemory
1208 ReleaseSRWLockExclusive
1209 ReleaseSRWLockShared
1210 ReleaseSemaphore
1215 RemoveDirectoryW
1228 ResetEvent
1235 ResumeThread
1237 RtlCaptureContext
1244 RtlLookupFunctionEntry
1246 RtlPcToFileHeader
1249 RtlUnwind
1250 RtlUnwindEx
1251 RtlVirtualUnwind
1273 SetConsoleCtrlHandler
1289 SetConsoleMode
1297 SetConsoleScreenBufferSize
1305 SetCurrentDirectoryW
1312 SetEndOfFile
1315 SetEnvironmentVariableA
1316 SetEnvironmentVariableW
1317 SetErrorMode
1318 SetEvent
1322 SetFileAttributesA
1330 SetFilePointer
1331 SetFilePointerEx
1345 SetLastError
1371 SetStdHandle
1382 SetThreadDescription
1384 SetThreadExecutionState
1391 SetThreadPriority
1407 SetUnhandledExceptionFilter
1423 Sleep
1424 SleepConditionVariableCS
1425 SleepConditionVariableSRW
1426 SleepEx
1430 SubmitThreadpoolWork
1431 SuspendThread
1433 SwitchToThread
1435 SystemTimeToTzSpecificLocalTime
1438 TerminateProcess
1456 TlsAlloc
1457 TlsFree
1458 TlsGetValue
1459 TlsSetValue
1463 TryAcquireSRWLockExclusive
1465 TryEnterCriticalSection
1472 UnhandledExceptionFilter
1492 VerSetConditionMask
1496 VerifyVersionInfoW
1497 VirtualAlloc
1500 VirtualFree
1503 VirtualProtect
1514 WaitForSingleObject
1515 WaitForSingleObjectEx
1519 WaitForThreadpoolWorkCallbacks
1522 WakeAllConditionVariable
1523 WakeConditionVariable
1553 WideCharToMultiByte
1572 WriteConsoleW
1573 WriteFile
```

### SHELL32.dll (Windows Shell)

```
8   CommandLineToArgvW
36  DragAcceptFiles
37  DragFinish
41  DragQueryFileW
52  ExtractIconExW
156 SHCreateDirectoryExW
335 SHGetFolderPathW
426 ShellExecuteA
430 ShellExecuteW
```

### bink2w64.dll (Bink Video Codec)

Used for playing pre-rendered video cinematics.

```
0  BinkAllocateFrameBuffers
1  BinkClose
7  BinkDoFrameAsync
9  BinkDoFrameAsyncWait
12 BinkFreeGlobals
13 BinkGetError
14 BinkGetFrameBuffersInfo
25 BinkGoto
27 BinkNextFrame
28 BinkOpen
38 BinkRegisterFrameBuffers
40 BinkRequestStopAsyncThread
49 BinkSetOSFileCallbacks
52 BinkSetSoundOnOff
60 BinkShouldSkip
61 BinkStartAsyncThread
72 BinkWait
73 BinkWaitStopAsyncThread
```

### D3DCOMPILER_47.dll (DirectX Shader Compiler)

```
1  D3DCompile
22 D3DReflect
```

### ADVAPI32.dll (Windows Security)

```
193 CryptAcquireContextA
196 CryptCreateHash
199 CryptDestroyHash
213 CryptGetHashParam
217 CryptHashData
220 CryptReleaseContext
378 GetUserNameA
533 OpenProcessToken
603 RegCloseKey
640 RegGetValueA
651 RegOpenKeyExA
652 RegOpenKeyExW
664 RegQueryValueExA
665 RegQueryValueExW
```

### pops_api.dll (Paradox Online Platform Services)

Handles Paradox account integration, telemetry, and inventory.

```
2   POPS_AccountConnectAccountSteam
4   POPS_AccountConnections
5   POPS_AccountCreate
7   POPS_AccountDisconnectAccountSteam
11  POPS_AccountGetCountries
12  POPS_AccountGetDetails
13  POPS_AccountGetGuid
14  POPS_AccountGetLanguages
18  POPS_AccountLogIn
21  POPS_AccountLogInSteamTicket
23  POPS_AccountLogInWithAuthToken
25  POPS_AccountResetPassword
37  POPS_AutoStandardTelemetryEnable
56  POPS_Initialize
60  POPS_InventoryList
99  POPS_RunCallbacks
102 POPS_SetFileIO
104 POPS_SetRootPath
106 POPS_Shutdown
121 POPS_SocialProfileCreate
123 POPS_SocialProfileRetrieve
124 POPS_SocialProfileUpdate
144 POPS_TelemetrySendMulti
147 POPS_TokenRetrieveCurrent
```

### VERSION.dll

```
0  GetFileVersionInfoA
4  GetFileVersionInfoSizeA
15 VerQueryValueA
```

### nvtt.dll (NVIDIA Texture Tools)

Used for DXT texture compression.

```
0  nvtt::CompressionOptions::CompressionOptions()
1  nvtt::Compressor::Compressor()
2  nvtt::InputOptions::InputOptions()
3  nvtt::OutputOptions::OutputOptions()
4  nvtt::CompressionOptions::~CompressionOptions()
5  nvtt::Compressor::~Compressor()
6  nvtt::InputOptions::~InputOptions()
7  nvtt::OutputOptions::~OutputOptions()
8  nvtt::Compressor::enableCudaAcceleration(bool)
9  nvtt::errorString(nvtt::Error)
10 nvtt::Compressor::estimateSize(nvtt::InputOptions const&, nvtt::CompressionOptions const&)
12 nvtt::Compressor::process(nvtt::InputOptions const&, nvtt::CompressionOptions const&, nvtt::OutputOptions const&)
21 nvtt::OutputOptions::setErrorHandler(nvtt::ErrorHandler*)
24 nvtt::CompressionOptions::setFormat(nvtt::Format)
31 nvtt::InputOptions::setMipmapData(void const*, int, int, int, int, int)
33 nvtt::InputOptions::setMipmapGeneration(bool, int)
37 nvtt::OutputOptions::setOutputHandler(nvtt::OutputHandler*)
43 nvtt::InputOptions::setTextureLayout(nvtt::TextureType, int, int, int)
```

### GDI32.dll (Graphics Device Interface)

```
19  BitBlt
25  ChoosePixelFormat
34  CombineRgn
41  CreateBitmap
48  CreateCompatibleBitmap
49  CreateCompatibleDC
52  CreateDCW
55  CreateDIBSection
67  CreateFontIndirectW
83  CreateRectRgn
90  CreateSolidBrush
384 DeleteDC
387 DeleteObject
388 DescribePixelFormat
634 GetDIBits
635 GetDeviceCaps
636 GetDeviceGammaRamp
665 GetICMProfileW
683 GetObjectA
692 GetPixel
693 GetPixelFormat
718 GetTextExtentPoint32A
727 GetTextMetricsW
868 SelectObject
887 SetDeviceGammaRamp
904 SetPixel
905 SetPixelFormat
932 SwapBuffers
```

### nakama-cpp.dll (Heroic Labs Nakama - Multiplayer)

Nakama is an open-source distributed server for social and realtime games.

```
563 NClient_addFriends
564 NClient_addGroupUsers
565 NClient_authenticateApple
566 NClient_authenticateCustom
567 NClient_authenticateDevice
568 NClient_authenticateEmail
569 NClient_authenticateFacebook
570 NClient_authenticateGameCenter
571 NClient_authenticateGoogle
572 NClient_authenticateSteam
573 NClient_blockFriends
574 NClient_createGroup
576 NClient_createRtClientEx
577 NClient_deleteFriends
578 NClient_deleteGroup
579 NClient_deleteLeaderboardRecord
580 NClient_deleteNotifications
581 NClient_deleteStorageObjects
582 NClient_demoteGroupUsers
583 NClient_disconnect
584 NClient_getAccount
585 NClient_getUserData
586 NClient_getUsers
587 NClient_importFacebookFriends
588 NClient_joinGroup
589 NClient_joinTournament
590 NClient_kickGroupUsers
591 NClient_leaveGroup
592 NClient_linkApple
593 NClient_linkCustom
594 NClient_linkDevice
595 NClient_linkEmail
596 NClient_linkFacebook
597 NClient_linkGameCenter
598 NClient_linkGoogle
599 NClient_linkSteam
600 NClient_listChannelMessages
601 NClient_listFriends
602 NClient_listGroupUsers
603 NClient_listGroups
604 NClient_listLeaderboardRecords
605 NClient_listLeaderboardRecordsAroundOwner
606 NClient_listMatches
607 NClient_listNotifications
609 NClient_listStorageObjects
610 NClient_listTournamentRecords
611 NClient_listTournamentRecordsAroundOwner
612 NClient_listTournaments
613 NClient_listUserGroups
614 NClient_listUsersStorageObjects
615 NClient_promoteGroupUsers
616 NClient_readStorageObjects
617 NClient_rpc
618 NClient_rpc_with_http_key
619 NClient_setErrorCallback
620 NClient_setUserData
621 NClient_tick
622 NClient_unlinkApple
623 NClient_unlinkCustom
624 NClient_unlinkDevice
625 NClient_unlinkEmail
626 NClient_unlinkFacebook
627 NClient_unlinkGameCenter
628 NClient_unlinkGoogle
629 NClient_unlinkSteam
630 NClient_updateAccount
631 NClient_updateGroup
632 NClient_writeLeaderboardRecord
633 NClient_writeStorageObjects
634 NClient_writeTournamentRecord
641 NRtClient_addMatchmaker
642 NRtClient_connect
643 NRtClient_createMatch
644 NRtClient_destroy
645 NRtClient_disconnect
646 NRtClient_followUsers
647 NRtClient_getUserData
648 NRtClient_isConnected
649 NRtClient_joinChat
650 NRtClient_joinMatch
651 NRtClient_joinMatchByToken
652 NRtClient_leaveChat
653 NRtClient_leaveMatch
654 NRtClient_removeChatMessage
655 NRtClient_removeMatchmaker
656 NRtClient_rpc
657 NRtClient_sendMatchData
658 NRtClient_setChannelMessageCallback
659 NRtClient_setChannelPresenceCallback
660 NRtClient_setConnectCallback
661 NRtClient_setDisconnectCallback
662 NRtClient_setErrorCallback
663 NRtClient_setMatchDataCallback
664 NRtClient_setMatchPresenceCallback
665 NRtClient_setMatchmakerMatchedCallback
666 NRtClient_setNotificationsCallback
667 NRtClient_setStatusPresenceCallback
668 NRtClient_setStreamDataCallback
669 NRtClient_setStreamPresenceCallback
670 NRtClient_setUserData
671 NRtClient_tick
672 NRtClient_unfollowUsers
673 NRtClient_updateChatMessage
675 NRtClient_writeChatMessage
676 NSession_destroy
677 NSession_getAuthToken
678 NSession_getCreateTime
679 NSession_getExpireTime
680 NSession_getUserId
681 NSession_getUsername
683 NSession_getVariables
684 NSession_isCreated
685 NSession_isExpired
686 NSession_isExpiredByTime
687 NStringDoubleMap_create
688 NStringDoubleMap_destroy
689 NStringDoubleMap_getKeys
690 NStringDoubleMap_getSize
691 NStringDoubleMap_getValue
692 NStringDoubleMap_setValue
693 NStringMap_create
694 NStringMap_destroy
695 NStringMap_getKeys
696 NStringMap_getSize
697 NStringMap_getValue
698 NStringMap_setValue
699 createDefaultNakamaClient
702 destroyNakamaClient
```

### IMM32.dll (Input Method Manager)

```
26  ImmAssociateContext
52  ImmGetCandidateListW
57  ImmGetCompositionStringW
59  ImmGetContext
72  ImmGetIMEFileNameA
100 ImmNotifyIME
107 ImmReleaseContext
114 ImmSetCandidateWindow
118 ImmSetCompositionStringW
119 ImmSetCompositionWindow
```

### steam_api64.dll (Steam Integration)

```
3    SteamAPI_GetHSteamUser
926  SteamAPI_Init
929  SteamAPI_IsSteamRunning
936  SteamAPI_RegisterCallResult
937  SteamAPI_RegisterCallback
940  SteamAPI_RunCallbacks
944  SteamAPI_Shutdown
1031 SteamAPI_UnregisterCallResult
1032 SteamAPI_UnregisterCallback
1053 SteamGameServer_GetHSteamUser
1057 SteamGameServer_RunCallbacks
1058 SteamGameServer_Shutdown
1059 SteamInternal_ContextInit
1061 SteamInternal_FindOrCreateGameServerInterface
1062 SteamInternal_FindOrCreateUserInterface
1063 SteamInternal_GameServer_Init
```

### dxcompiler.dll (DirectX Shader Compiler)

```
0 DxcCreateInstance
```

### d3d11.dll (Direct3D 11)

```
6 D3D11CreateDevice
```

### dxgi.dll (DirectX Graphics Infrastructure)

```
4 CreateDXGIFactory1
```

### SHLWAPI.dll (Shell Lightweight API)

```
55 PathAppendW
73 PathFileExistsW
```

### WS2_32.dll (Windows Sockets)

```
closesocket (Ordinal 3)
ntohl (Ordinal 14)
select (Ordinal 18)
gethostname (Ordinal 57)
WSAGetLastError (Ordinal 111)
WSASetLastError (Ordinal 112)
WSAStartup (Ordinal 115)
__WSAFDIsSet (Ordinal 151)
164 freeaddrinfo
165 getaddrinfo
182 inet_pton
```

### OLEAUT32.dll (OLE Automation)

```
SysFreeString (Ordinal 6)
```

### ole32.dll (OLE/COM)

```
16  CLSIDFromString
43  CoCreateInstance
97  CoInitializeEx
140 CoTaskMemFree
144 CoUninitialize
463 PropVariantClear
```

### SETUPAPI.dll (Device Installation)

```
84  CM_Get_Device_IDA
128 CM_Get_Parent
150 CM_Locate_DevNodeA
317 SetupDiDestroyDeviceInfoList
320 SetupDiEnumDeviceInfo
321 SetupDiEnumDeviceInterfaces
337 SetupDiGetClassDevsA
363 SetupDiGetDeviceInterfaceDetailA
369 SetupDiGetDeviceRegistryPropertyA
```

### WINMM.dll (Windows Multimedia)

```
134 timeBeginPeriod
135 timeEndPeriod
138 timeGetTime
141 waveInAddBuffer
142 waveInClose
144 waveInGetDevCapsW
148 waveInGetNumDevs
151 waveInOpen
152 waveInPrepareHeader
153 waveInReset
154 waveInStart
156 waveInUnprepareHeader
158 waveOutClose
160 waveOutGetDevCapsW
162 waveOutGetErrorTextW
164 waveOutGetNumDevs
170 waveOutOpen
172 waveOutPrepareHeader
173 waveOutReset
178 waveOutUnprepareHeader
179 waveOutWrite
```

---

## Exports

The executable exports two symbols for GPU selection on hybrid graphics systems:

```
E     1 04DB73BC AmdPowerXpressRequestHighPerformance  (Hint: 0)
E     2 04DB73B8 NvOptimusEnablement  (Hint: 1)
```

These exports tell the graphics driver to prefer the dedicated GPU over integrated graphics.

---

## Technical Notes

### Clausewitz Engine
CK3 is built on Paradox's **Clausewitz** engine with the **Jomini** layer for character-focused gameplay. The engine handles:
- Script parsing and execution
- Map rendering
- Character/dynasty simulation
- Multiplayer synchronization

### Threading Model
The KERNEL32 imports show sophisticated threading:
- Thread pools (`CreateThreadpoolWork`, `SubmitThreadpoolWork`)
- Condition variables (`SleepConditionVariableCS`, `WakeConditionVariable`)
- Slim reader-writer locks (`AcquireSRWLockExclusive`, `AcquireSRWLockShared`)
- Critical sections for synchronization

### Graphics Pipeline
- DirectX 11 via `d3d11.dll`
- HLSL shader compilation via `dxcompiler.dll` and `D3DCOMPILER_47.dll`
- DXGI for display management

### Input Handling
- Raw input devices (`RegisterRawInputDevices`, `GetRawInputData`)
- IME support for non-Latin text input
- Keyboard/mouse state tracking
