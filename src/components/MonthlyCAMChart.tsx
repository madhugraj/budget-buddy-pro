import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface MonthlyCAMChartProps {
    data: Array<{
        month: string;
        paid_flats: number;
        pending_flats: number;
    }>;
}

export function MonthlyCAMChart({ data }: MonthlyCAMChartProps) {
    return (
        <Card className="border-none shadow-lg">
            <CardHeader>
                <CardTitle className="text-xl font-bold">Monthly CAM Collection</CardTitle>
                <CardDescription>Paid vs Pending flats per month</CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis
                            tick={{ fontSize: 11 }}
                            label={{ value: 'Flats', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                        />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-popover p-3 border border-border rounded-lg shadow-lg">
                                            <p className="font-bold mb-1">{data.month}</p>
                                            <p className="text-green-600 text-sm">Paid: {data.paid_flats}</p>
                                            <p className="text-red-600 text-sm">Pending: {data.pending_flats}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="paid_flats" name="Paid" fill="#22c55e" />
                        <Bar dataKey="pending_flats" name="Pending" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
