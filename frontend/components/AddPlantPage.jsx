import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AddPlantPage() {
  return (
    <div className="min-h-screen bg-green-50 px-6 py-10">
      {/* Page Header */}
      <div className="max-w-3xl mx-auto mb-8 flex items-start gap-4">
        <a href="/" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition">← Back</a>
        <div>
          <h1 className="text-3xl font-bold text-green-700">➕ Add a New Plant</h1>
        <p className="text-gray-600 mt-2">Enter basic details so PlantVita can start monitoring your plant’s health.</p>
        </div>
      </div>
      

      {/* Form Card */}
      <Card className="max-w-3xl mx-auto rounded-2xl shadow-lg">
        <CardContent className="p-6">
          <form className="space-y-6">
            {/* Plant Name */}
            <div>
              <label className="block text-sm font-medium mb-1">Plant Name</label>
              <input
                type="text"
                placeholder="e.g. Monstera Deliciosa"
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Plant Type */}
            <div>
              <label className="block text-sm font-medium mb-1">Plant Type</label>
              <select className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600">
                <option>Indoor</option>
                <option>Outdoor</option>
                <option>Succulent</option>
                <option>Herb</option>
              </select>
            </div>

            {/* Soil Texture */}
            <div>
              <label className="block text-sm font-medium mb-1">Soil Texture</label>
              <select className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600">
                <option>Loamy</option>
                <option>Sandy</option>
                <option>Clay</option>
                <option>Silty</option>
              </select>
            </div>

            {/* Sensor Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Moisture Sensor ID</label>
                <input
                  type="text"
                  placeholder="Optional"
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Light Sensor ID</label>
                <input
                  type="text"
                  placeholder="Optional"
                  className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium mb-1">Plant Location</label>
              <input
                type="text"
                placeholder="e.g. Balcony, Living Room"
                className="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline">Cancel</Button>
              <Button className="bg-green-700 hover:bg-green-800">Save Plant</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
