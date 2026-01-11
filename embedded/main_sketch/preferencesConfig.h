#ifndef PREFERENCES_CONFIG_H
#define PREFERENCES_CONFIG_H

#include <Preferences.h>
#include "config.h"

void clearPreferences(String id) {
    pref.begin(id.c_str(), false);
    pref.clear();
    pref.end();
}

void setWifiCreds(String ssid, String pass) {
  pref.begin("wifi-creds", false);
  pref.putString("ssid", ssid);
  pref.putString("pass", pass);
  pref.end();
}

#endif