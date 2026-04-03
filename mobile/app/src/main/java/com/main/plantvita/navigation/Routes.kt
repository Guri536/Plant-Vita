package com.main.plantvita.navigation

object Routes {
    const val AUTH = "auth"
    const val HOME = "home"
    const val PROFILE = "profile"
    const val ADD_DEVICE = "add_device"

    const val SETUP_PLANT = "setup_plant/{plantId}"
    fun createSetupPlantRoute(plantId: Int) = "setup_plant/$plantId"

    const val PLANT_DETAIL = "plant_detail/{plantId}"
    fun createPlantDetailRoute(plantId: Int) = "plant_detail/$plantId"
}