package com.main.plantvita.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.os.Build
import java.net.Inet4Address

object NetworkConfig {

    private const val DEV_BASE_URL = "http://192.168.137.1:8000"
    fun getBaseUrl(context: Context): String {
//        var gatewayIp: String? = null
//
//        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
//        val network = connectivityManager.activeNetwork
//        val linkProperties = connectivityManager.getLinkProperties(network)
//
//        val defaultRoute = linkProperties?.routes?.firstOrNull { route ->
//            route.isDefaultRoute && route.gateway is Inet4Address
//        }
//        gatewayIp = defaultRoute?.gateway?.hostAddress
//        println("NetworkConfig: Connected to IP: $gatewayIp")
        return DEV_BASE_URL
    }
}

