package com.rfcellsensor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoLte
import android.telephony.CellInfoNr
import android.telephony.CellIdentityNr
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.PhoneStateListener
import android.telephony.ServiceState
import android.telephony.SignalStrength
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager

class RadioMonitor(
    private val context: Context,
    private val onSnapshot: (RadioSnapshot) -> Unit,
    private val onServiceText: (String) -> Unit
) {
    private val telephony = context.getSystemService(TelephonyManager::class.java)
    private var modernCallback: ModernCallback? = null
    @Suppress("DEPRECATION")
    private var legacyListener: PhoneStateListener? = null

    fun start() {
        if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)) {
            onServiceText("No telephony radio")
            return
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val callback = ModernCallback()
                modernCallback = callback
                telephony.registerTelephonyCallback(context.mainExecutor, callback)
            } else {
                @Suppress("DEPRECATION")
                val listener = object : PhoneStateListener() {
                    override fun onSignalStrengthsChanged(signalStrength: SignalStrength) {
                        emit(signalStrength)
                    }
                    override fun onServiceStateChanged(serviceState: ServiceState?) {
                        onServiceText(serviceLabel(serviceState))
                    }
                }
                legacyListener = listener
                @Suppress("DEPRECATION")
                telephony.listen(
                    listener,
                    PhoneStateListener.LISTEN_SIGNAL_STRENGTHS or PhoneStateListener.LISTEN_SERVICE_STATE
                )
            }
        } catch (security: SecurityException) {
            onServiceText("Radio permission required")
        } catch (unsupported: UnsupportedOperationException) {
            onServiceText("Telephony monitoring unsupported")
        }
    }

    fun stop() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                modernCallback?.let { telephony.unregisterTelephonyCallback(it) }
                modernCallback = null
            } else {
                @Suppress("DEPRECATION")
                legacyListener?.let { telephony.listen(it, PhoneStateListener.LISTEN_NONE) }
                legacyListener = null
            }
        } catch (_: Exception) {
            // Lifecycle cleanup should never crash the app.
        }
    }

    private fun emit(signalStrength: SignalStrength) {
        val strengths = signalStrength.cellSignalStrengths
        val nr = strengths.filterIsInstance<CellSignalStrengthNr>().firstOrNull()
        val lte = strengths.filterIsInstance<CellSignalStrengthLte>().firstOrNull()
        val inferredType: String
        val rsrp: Int?
        val rsrq: Int?
        val rssi: Int?
        val sinr: Int?

        when {
            nr != null -> {
                inferredType = "5G NR"
                rsrp = normalizeTelephonyInt(nr.ssRsrp)
                rsrq = normalizeTelephonyInt(nr.ssRsrq)
                rssi = null
                sinr = normalizeTelephonyInt(nr.ssSinr)
                    ?: normalizeTelephonyInt(nr.csiSinr)
            }
            lte != null -> {
                inferredType = "LTE"
                rsrp = normalizeTelephonyInt(lte.rsrp)
                rsrq = normalizeTelephonyInt(lte.rsrq)
                rssi = normalizeTelephonyInt(lte.rssi)
                sinr = normalizeTelephonyInt(lte.rssnr)
            }
            strengths.isNotEmpty() -> {
                inferredType = strengths.first()::class.java.simpleName.removePrefix("CellSignalStrength")
                rsrp = null
                rsrq = null
                rssi = normalizeTelephonyInt(strengths.first().dbm)
                sinr = null
            }
            else -> {
                inferredType = safeNetworkTypeLabel()
                rsrp = null
                rsrq = null
                rssi = null
                sinr = null
            }
        }

        onSnapshot(
            RadioSnapshot(
                capturedAtEpochMillis = System.currentTimeMillis(),
                networkType = if (inferredType.isBlank()) safeNetworkTypeLabel() else inferredType,
                rsrp = rsrp,
                rsrq = rsrq,
                rssi = rssi,
                sinr = sinr,
                cellId = servingCellId()
            )
        )
    }

    private fun servingCellId(): String? {
        if (context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED ||
            context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) return null
        return try {
            val registered = telephony.allCellInfo?.firstOrNull { it.isRegistered }
                ?: telephony.allCellInfo?.firstOrNull()
            when (registered) {
                is CellInfoNr -> {
                    val identity = registered.cellIdentity as? CellIdentityNr
                    val id = identity?.nci?.let(::normalizeTelephonyLong)
                    id?.let { "NR NCI $it" }
                }
                is CellInfoLte -> {
                    val id = normalizeTelephonyInt(registered.cellIdentity.ci)
                    id?.let { "LTE CI $it" }
                }
                else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    registered?.cellIdentity?.toString()?.take(80)
                } else {
                    null
                }
            }
        } catch (_: SecurityException) {
            null
        } catch (_: UnsupportedOperationException) {
            null
        }
    }

    private fun safeNetworkTypeLabel(): String = try {
        if (context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) != PackageManager.PERMISSION_GRANTED) {
            "Cellular"
        } else {
            when (telephony.dataNetworkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G NR"
                TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
                TelephonyManager.NETWORK_TYPE_HSPAP -> "HSPA+"
                TelephonyManager.NETWORK_TYPE_HSPA -> "HSPA"
                TelephonyManager.NETWORK_TYPE_UMTS -> "3G UMTS"
                TelephonyManager.NETWORK_TYPE_EDGE -> "EDGE"
                TelephonyManager.NETWORK_TYPE_GPRS -> "GPRS"
                TelephonyManager.NETWORK_TYPE_UNKNOWN -> "Cellular"
                else -> "Cellular"
            }
        }
    } catch (_: SecurityException) {
        "Cellular"
    }

    private fun serviceLabel(serviceState: ServiceState?): String = when (serviceState?.state) {
        ServiceState.STATE_IN_SERVICE -> "In service"
        ServiceState.STATE_EMERGENCY_ONLY -> "Emergency only"
        ServiceState.STATE_OUT_OF_SERVICE -> "Out of service"
        ServiceState.STATE_POWER_OFF -> "Radio off"
        else -> "Service state unknown"
    }

    @android.annotation.TargetApi(Build.VERSION_CODES.S)
    private inner class ModernCallback : TelephonyCallback(),
        TelephonyCallback.SignalStrengthsListener,
        TelephonyCallback.ServiceStateListener {
        override fun onSignalStrengthsChanged(signalStrength: SignalStrength) {
            emit(signalStrength)
        }

        override fun onServiceStateChanged(serviceState: ServiceState) {
            onServiceText(serviceLabel(serviceState))
        }
    }
}
